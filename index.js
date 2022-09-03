import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";

const mongoClient = new MongoClient("mongodb://localhost:27017");
let db;

mongoClient.connect().then(() => db = mongoClient.db("teste"));

const server = express();
server.use(cors());
server.use(express.json());

//PARTICIPANTS
server.post("/participants", async (req, res) => {
    const { name } = req.body;
    if (!name || name === " ") {
        return res.sendStatus(422);
    }

    try {
        const participant = await db.collection("participants").findOne({name});
        if (participant) {
            return res.sendStatus(409);
        }

        const lastStatus = Date.now();
        await db.collection("participants").insertOne({name, lastStatus: lastStatus});
        await db.collection("messages").insertOne({from: name, to: "Todos", text: "entra na sala...", type: "status", time: dayjs(lastStatus).format("HH:mm:ss")});
        res.sendStatus(201);
    } catch (error) {
        console.log(error)
    }  
})

server.get("/participants", async (req, res) => {

    try {
        const participants = await db.collection("participants").find().toArray()
        res.send(participants);
    } catch (error) {
        console.log(error)
    }
})

//MESSAGES
server.post("/messages", async (req, res) => {
    const { to, text, type} = req.body;
    const from = req.headers.user;

    if (!to || 
        !text || 
        (type !== "message" && type !== "private_message")) 
    {
        return res.sendStatus(422);
    }

    try {
        const participant = await db.collection("participants").findOne({name: from});
        if (participant) {
            const time = dayjs().format("HH:mm:ss");
            await db.collection("messages").insertOne({from, to, text, type, time});
            return res.sendStatus(201);
        }
        
        return res.sendStatus(422);

    } catch (error) {
        console.log(error);
    }   
})

server.get("/messages", async (req, res) => {
    const { user } = req.headers;
    const limit = Number(req.query.limit);
    let showedMessages = []

    try {
        const messages = await db.collection("messages").find().toArray();
        showedMessages = messages.filter (message =>  
            message.from === user || 
            message.type === "status" ||
            message.type === "message" || 
            message.to === user);
    
        if (limit) {
            showedMessages = messages.slice(0, limit);
        }
        
        res.send(showedMessages);
    
    } catch (error) {    
        console.log(error);
    }
})

//STATUS
server.post("/status", async (req, res) => {
    const user = req.headers.user;

    try {
        const isUser = await db.collection("participants").findOne({name: user});
        if (isUser) {
            await db.collection("participants").updateOne({name: user}, {$set: {"lastStatus": dayjs().format("HH:mm:ss")}});
            return res.sendStatus(200);
        } 

        return res.sendStatus(404);

    } catch (error) {
        console.log(error);
    }
})

setInterval(async () => {
    const participants = await db.collection("participants").find().toArray();
    const toDelete = participants.filter(() => (Date.now() - participants.lastStatus) > 10000);
    
}, 15000)


server.listen(5000, () => console.log("listening on 5000"))