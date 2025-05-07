const express = require('express');
const mongoose = require('mongoose');
const Agenda = require('agenda');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

mongoose.connect('mongodb+srv://yashplw:5OXwSDs9VXBMsG21@cluster0.4t324va.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const flowSchema = new mongoose.Schema({
  nodes: Array,
  edges: Array,
  createdAt: { type: Date, default: Date.now }
});
const Flow = mongoose.model('Flow', flowSchema);

const listSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});
const List = mongoose.model('List', listSchema);

const agenda = new Agenda({ 
  db: { address: 'mongodb+srv://yashplw:5OXwSDs9VXBMsG21@cluster0.4t324va.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0' },
  processEvery: '30 seconds'
});

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    secure: false,
    port: 587,
    auth: {
        user: 'powerswap.01@gmail.com',
        pass: 'Powerswap@123'
    }
});

agenda.define('send email', async (job) => {
  console.log('Processing email job:', job.attrs.data);
  const { email, subject, body } = job.attrs.data;
  
  try {
    const info = await transporter.sendMail({
      from: 'powerswap.01@gmail.com',
      to: email,
      subject,
      text: body, 
      html: body, 
    });
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
});

app.get('/api/lists', async (req, res) => {
  try {
    const lists = await List.find().sort({ name: 1 });
    res.json(lists);
  } catch (error) {
    console.error('Error fetching lists:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lists', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'List name is required' });
    }
    
    const existingList = await List.findOne({ name: name.trim() });
    if (existingList) {
      return res.status(400).json({ error: 'A list with this name already exists' });
    }
    
    const list = new List({ name: name.trim() });
    await list.save();
    
    res.status(201).json(list);
  } catch (error) {
    console.error('Error creating list:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/save-flow', async (req, res) => {
  try {
    console.log('Saving flow:', req.body);
    const flow = new Flow(req.body);
    await flow.save();
    res.json({ 
      message: 'Flow saved successfully',
      id: flow._id
    });
  } catch (error) {
    console.error('Error saving flow:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/schedule-email', async (req, res) => {
  const { email, subject, body, time } = req.body;
  
  if (!email || !subject || !body || !time) {
    return res.status(400).json({ 
      error: 'Missing required fields: email, subject, body, time' 
    });
  }
  
  try {
    console.log(`Scheduling email to ${email} for ${time}`);
    await agenda.schedule(new Date(time), 'send email', { email, subject, body });
    res.json({ 
      message: 'Email scheduled successfully',
      scheduledFor: time
    });
  } catch (error) {
    console.error('Error scheduling email:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/flows', async (req, res) => {
  try {
    const flows = await Flow.find().sort({ createdAt: -1 });
    res.json(flows);
  } catch (error) {
    console.error('Error fetching flows:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/flows/:id', async (req, res) => {
  try {
    const flow = await Flow.findById(req.params.id);
    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' });
    }
    res.json(flow);
  } catch (error) {
    console.error('Error fetching flow:', error);
    res.status(500).json({ error: error.message });
  }
});

(async () => {
  try {
    await agenda.start();
    console.log('Agenda started');
    
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
  }
})();
