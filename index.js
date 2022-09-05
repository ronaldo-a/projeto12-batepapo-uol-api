import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import Joi from "joi";
import dotenv from "dotenv";
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => db = mongoClient.db("batepapouol"));

const server = express();
server.use(cors());
server.use(express.json());

//SCHEMAS
const userSchema = Joi.object({name: Joi.string().empty(" ").required()})
const messageSchema = Joi.object({ to: Joi.string().empty(" ").required(),
                                    text: Joi.string().empty(" ").required(),
                                    type: Joi.alternatives().try(Joi.string().pattern(/^message$/), Joi.string().pattern(/^private_message$/)).required()
})

//PARTICIPANTS
server.post("/participants", async (req, res) => {
    const validation = userSchema.validate(req.body)
    if (validation.error) {
        res.status(422).send(validation.error.details[0].message);
        return
    }

    const { name } = req.body
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
        res.sendStatus(500);
    }  
})

server.get("/participants", async (req, res) => {

    try {
        const participants = await db.collection("participants").find().toArray()
        res.send(participants);
    } catch (error) {
        res.sendStatus(500);
    }
})

//MESSAGES
server.post("/messages", async (req, res) => {
    const validation = messageSchema.validate(req.body, {abortEarly: false}) 
    if (validation.error) {
        const errors = validation.error.details.map(error => error.message)
        return res.status(422).send(errors);
    }
    
    const from = req.headers.user;
    const {to, text, type} = req.body; 
    try {
        const participant = await db.collection("participants").findOne({name: from});
        if (participant) {
            const time = dayjs().format("HH:mm:ss");
            await db.collection("messages").insertOne({from, to, text, type, time});
            return res.sendStatus(201);
        }
        
        return res.sendStatus(422);
    } catch (error) {
        res.sendStatus(500);
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
            showedMessages = showedMessages.slice(-limit);
        }
        
        res.send(showedMessages);
    
    } catch (error) {    
        res.sendStatus(500);
    }
})

//STATUS
server.post("/status", async (req, res) => {
    const user = req.headers.user;

    try {
        const isUser = await db.collection("participants").findOne({name: user});
        if (isUser) {
            await db.collection("participants").updateOne({name: user}, {$set: {"lastStatus": Date.now()}});
            return res.sendStatus(200);
        } 

        return res.sendStatus(404);

    } catch (error) {
        res.sendStatus(500);
    }
})

//REMOÇÃO AUTOMÁTICA DE USUÁRIO INATIVO
setInterval(async () => {

    try {
        const participants = await db.collection("participants").find().toArray();
        const toDeleteParticipants = participants.filter(participant => (Date.now() - participant.lastStatus) > 10000);

        toDeleteParticipants.map(async participant => {
            const message = {from: participant.name, to: "Todos", text: "sai da sala...", type: "status", time: dayjs().format("HH:mm:ss")};
            await db.collection("participants").deleteOne({_id: participant._id});
            await db.collection("messages").insertOne(message);
        })
    } catch (error) {
        res.sendStatus(500);
    }       
}, 15000)

//DELETE MESSAGE
server.delete("/messages/:id", async (req, res) => {
    const { user } = req.headers;
    const { id } = req.params;

    try {
        const message = await db.collection("messages").findOne({_id: ObjectId(id)});
        if (message) {
            if (message.from === user) {
                await db.collection("messages").deleteOne({_id: ObjectId(id)});
                return res.sendStatus(200);
            }
            return res.sendStatus(401); 
        }

        return res.sendStatus(404);
    } catch {
        res.sendStatus(500);
    }
})

server.listen(5000, () => console.log("listening on 5000"))