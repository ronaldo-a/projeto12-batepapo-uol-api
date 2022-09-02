import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

const mongoClient = new MongoClient("mongodb://localhost:27017");
let db;

mongoClient.connect().then(() => db = mongoClient.db("teste"));

const server = express();
server.use(cors());
server.use(express.json());

const participants = [{name: "Ronaldo"}, {name: "Mione"}, {name: "Rony"}];
const messages = [{}];

//PARTICIPANTS
server.post("/participants", (req, res) => {
    const { name } = req.body;
    if (!name || name === " ") {
        return res.sendStatus(422);
    } else if (participants.find(participant => participant.name === name)) {
        return res.sendStatus(409);
    }

    const lastStatus = Date.now()
    db.collection("participants").insertOne({name, lastStatus: lastStatus});
    db.collection("messages").insertOne({from: name, to: "Todos", text: "entra na sala...", type: "status", time: lastStatus});
    db.collection("participants").find().toArray().then(users => console.log(users));
    db.collection("messages").find().toArray().then(messages => console.log(messages));
    res.sendStatus(201);
})

server.get("/participants", (req, res) => {
    res.send(participants);
})

//MESSAGES
server.post("/messages", (req, res) => {
    const { to, text, type} = req.body;
    const from = req.headers.user;

    if (!to || 
        !text || 
        (type !== "message" && type !== "private_message") || 
        !(participants.find(participant => participant.name === from))) {
        return res.sendStatus(422);
    }

    const time = Date.now();
    messages.unshift({from, to, text, type, time});
    res.sendStatus(201);
})

server.get("/messages", (req, res) => {
    const { user } = req.headers
    const limit = Number(req.query.limit);

    let showedMessages = messages.filter(message => message.from === user || message.type === "message" || message.to === user);
    console.log(showedMessages)

    if (limit) {
        showedMessages = messages.slice(0, limit)
    }

    res.send(showedMessages)
})


server.listen(5000, () => console.log("listening on 5000"))