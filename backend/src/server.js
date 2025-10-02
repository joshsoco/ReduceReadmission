// Libraries
import express from 'express';
import dotenv from 'dotenv';

// Functions
import { connectDB } from './config/db';
import routes from './routes/routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Redirect /api/admin to /api/admin/login
app.use("/api/admin", (req, res, next) => {
    if (req.path === '/' || req.path === '') {
        return res.redirect('/api/admin/login');
    }
    next();
});
app.use("/api/admin", routes);

connectDB().then(()=>{
    app.listen(PORT,()=>{
        console.log(`Server is running on port ${PORT}`);
    });
});