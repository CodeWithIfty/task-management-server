const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: [process.env.LOCAL_CLIENT, process.env.CLIENT],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = process.env.DATABASE_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

    const taskCollection = client.db("tasklyDB").collection("tasks");

    app.get("/tasks/:email", async (req, res) => {
      try {
        const email = req.params.email;

        // Find documents that match the provided email
        const tasks = await taskCollection.find({ email }).toArray();

        if (!tasks || tasks.length === 0) {
          return res
            .status(404)
            .json({ message: "Tasks not found for the email" });
        }

        res.status(200).json({ tasks });
      } catch (err) {
        console.error("Error retrieving tasks:", err);
        res.status(500).json({ message: "Failed to retrieve tasks" });
      }
    });

    app.post("/addTodoTask", async (req, res) => {
      try {
        const { email, data } = req.body;
        const { description, title, priority, deadline } = data;

        // Find the document based on the email
        const document = await taskCollection.findOne({ email });

        if (!document) {
          // If document not found, create a new one
          const newData = {
            email,
            todo: [{ ...data, id: `task1`, status: "todo" }],
            inProgress: [],
            completed: [],
          };

          // Insert the new document
          await taskCollection.insertOne(newData);

          return res.status(200).json({ message: "Task Inserted", newData });
        }

        // Add a new task to the 'todo' array
        const newTask = {
          id: `task${document.todo.length + 2}`, // Generate unique ID
          title,
          description,
          priority,
          deadline,
          status: "todo",
        };

        document.todo.push(newTask);

        // Update the document with the modified 'todo' array
        await taskCollection.updateOne(
          { email }, // Find the document by email
          { $set: { todo: document.todo } } // Update 'todo' array in the document
        );

        res
          .status(201)
          .json({ message: "Task added to todo list", task: newTask });
      } catch (err) {
        console.error("Error adding task to todo:", err);
        res.status(500).json({ message: "Failed to add task to todo" });
      }
    });

    app.put("/updateTasks/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const updatedFields = req.body; // Assuming req.body contains the updated fields for tasks
        console.log(updatedFields);
        // Remove '_id' from updatedFields to avoid modifying the immutable '_id'
        delete updatedFields._id;

        // Find the document that matches the provided email
        const document = await taskCollection.findOne({ email });
        console.log("DocumetnF", document);
        if (!document) {
          return res
            .status(404)
            .json({ message: "Document not found for the email" });
        }

        // Replace the found document with the updatedFields
        await taskCollection.replaceOne({ email }, updatedFields);

        res.status(200).json({ message: "Tasks updated" });
      } catch (err) {
        console.error("Error updating tasks:", err);
        res.status(500).json({ message: "Failed to update tasks" });
      }
    });

    app.put("/updateSingleTask/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const { title, status, priority, id, description, deadline } = req.body;

        console.log(req.body);

        // Find the document that matches the provided email
        const document = await taskCollection.findOne({ email });

        if (!document) {
          return res
            .status(404)
            .json({ message: "Document not found for the email" });
        }

        let updatedDocument = { ...document };

        let targetArray, targetStatus;
        if (status === "todo") {
          targetArray = "todo";
          targetStatus = "todo";
        } else if (status === "inProgress") {
          targetArray = "inProgress";
          targetStatus = "inProgress";
        } else if (status === "completed") {
          targetArray = "completed";
          targetStatus = "completed";
        } else {
          return res.status(400).json({ message: "Invalid status" });
        }

        const taskIndex = updatedDocument[targetArray].findIndex(
          (task) => task.id === id
        );
        if (taskIndex !== -1) {
          // Update the task fields if provided in the request body
          if (title) updatedDocument[targetArray][taskIndex].title = title;
          if (priority)
            updatedDocument[targetArray][taskIndex].priority = priority;
          if (description)
            updatedDocument[targetArray][taskIndex].description = description;
          if (deadline)
            updatedDocument[targetArray][taskIndex].deadline = deadline;
          // Update the document in the collection
          await taskCollection.updateOne({ email }, { $set: updatedDocument });
        } else {
          return res
            .status(404)
            .json({ message: "Task not found in the specified array" });
        }

        res
          .status(200)
          .json({ message: "Task updated", document: updatedDocument });
      } catch (err) {
        console.error("Error updating task:", err);
        res.status(500).json({ message: "Failed to update task" });
      }
    });

    app.put("/deleteSingleTask/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const { status, id } = req.body;

        console.log({
          status,
          id,
        });
        // Find the document that matches the provided email
        const document = await taskCollection.findOne({ email });

        if (!document) {
          return res
            .status(404)
            .json({ message: "Document not found for the email" });
        }

        let updatedDocument = { ...document };

        let targetArray;
        if (status === "todo") {
          targetArray = "todo";
        } else if (status === "inProgress") {
          targetArray = "inProgress";
        } else if (status === "completed") {
          targetArray = "completed";
        } else {
          return res.status(400).json({ message: "Invalid status" });
        }

        const taskIndex = updatedDocument[targetArray].findIndex(
          (task) => task.id === id
        );
        if (taskIndex !== -1) {
          // Remove the task from the target array
          updatedDocument[targetArray].splice(taskIndex, 1);

          // Update the document in the collection
          await taskCollection.updateOne({ email }, { $set: updatedDocument });

          res
            .status(200)
            .json({ message: "Task deleted", document: updatedDocument });
        } else {
          return res
            .status(404)
            .json({ message: "Task not found in the specified array" });
        }
      } catch (err) {
        console.error("Error deleting task:", err);
        res.status(500).json({ message: "Failed to delete task" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
