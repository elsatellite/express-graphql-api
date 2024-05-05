import express from "express";
import cors from "cors";
import http from "http";
import "dotenv/config";
import gFunctions from "@google-cloud/functions-framework";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { resolvers, schemas, contextHandler } from "./graphql/index.js";
import { startStandaloneServer } from "@apollo/server/standalone";
import graphqlUploadExpress from "graphql-upload/graphqlUploadExpress.js";
import "./db/index.js";
import { handleRequest } from "./ocr/ocr.js";
import multer from "multer";
import bodyParser from "body-parser";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

const app = express();
const httpServer = http.createServer(app);

// Create the GraphQL server instance
const apolloServer = new ApolloServer({
  typeDefs: schemas,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  context: contextHandler,

  // Sandbox
  introspection: true,
});

await apolloServer.start();

// app.use(bodyParser.urlencoded({ extended: true }));

// Integrate GraphQL server with Express
app.use(
  "/graphql",
  cors(),
  express.json(),
  expressMiddleware(apolloServer, { context: contextHandler })
);

app.use("/graphql", graphqlUploadExpress());

app.post("/ocr", (req, res, next) => {
  console.log("/base64Image", !!req.body?.base64Image);
  console.log("/filename", req.body?.filename);
  if (!req.body?.base64Image) {
    res.status(400).send("No file uploaded");
    return;
  }

  const { filename, base64Image } = req.body;

  fs.writeFile(`./uploads/${filename}`, base64Image, "base64", function (err) {
    console.log(err);
  });

  handleRequest(`./uploads/${filename}`).then((text) => {
    res.status(200).send(text);
  });
});

gFunctions.http("graphql", app);
console.log("🚀  Running server on http://localhost:8080/graphql");
