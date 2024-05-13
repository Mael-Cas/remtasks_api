const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 7000;

// Connexion à la base de données MongoDB avec Mongoose
mongoose.connect(`mongodb://${process.env.DB_HOST}:27017/myapp`);

// Modèle Task

const taskSchema = new mongoose.Schema({
    content: { type: String, required: true },
    deadline: { type: Date, required: true },
    finish: { type: Boolean, default: false }
});

const Task = mongoose.model('Task', taskSchema);




// Modèle User
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }]
});
const User = mongoose.model('User', userSchema);

// Middleware pour autoriser le JSON dans les requêtes
app.use(express.json());



app.get('/users/:userId/email', async (req, res) => {

    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: "Utilisateur non trouvé" });
        }
        res.json({ email: user.email });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Erreur lors de la récupération de l'email de l'utilisateur" });
    }
});

// Route de création de compte
app.post('/users', async (req, res) => {
    try {
        const { email, password } = req.body;
        // Vérification si l'utilisateur existe déjà
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: "L'utilisateur existe déjà" });
        }
        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        // Création de l'utilisateur dans la base de données
        await User.create({ email, password: hashedPassword });
        res.status(201).json({ msg: "Utilisateur créé avec succès" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Erreur lors de la création de l'utilisateur" });
    }
});

// Route de connexion
app.post('/auth', async (req, res) => {
    try {
        const { email, password } = req.body;
        // Vérification si l'utilisateur existe
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ msg: "Email ou mot de passe incorrect" });
        }
        // Vérification du mot de passe
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ msg: "Email ou mot de passe incorrect" });
        }
        // Génération du token JWT
        const token = jwt.sign({ userId: user._id }, 'my-secret-key');
        res.json({
            token: token,
            IdUser: user._id,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Erreur lors de la connexion" });
    }
});

// Route pour ajouter une tâche à un utilisateur
app.post('/users/:userId/tasks',  async (req, res) => {

    try {
        const { userId } = req.params;
        const { task } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: "Utilisateur non trouvé" });
        }

        const tasksToAdd = task.map(({ content, deadline }) => ({ content, deadline }));
        const createdTasks = await Task.insertMany(tasksToAdd);

        // Ajouter les ID des tâches créées à l'utilisateur
        user.tasks.push(...createdTasks.map(task => task._id));
        await user.save();

        res.status(201).json({ msg: "Tâches ajoutées avec succès à l'utilisateur", tasks: createdTasks });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Erreur lors de l'ajout des tâches à l'utilisateur" });
    }
});

// Route pour supprimer une tâche d'un utilisateur
app.delete('/:userId/tasks/:taskId', async (req, res) => {
    try {

        const { userId } = req.params;
        const { taskId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: "Utilisateur non trouvé" });
        }
        // Vérifie si la tâche appartient à l'utilisateur
        if (!user.tasks.includes(taskId)) {

            return res.status(404).json({ msg: "Tâche non trouvée pour cet utilisateur" });
        }

        await Task.findByIdAndDelete(taskId);
        
        user.tasks.pull(taskId); // Retire la tâche de l'utilisateur
        await user.save();

        res.json({ msg: "Tâche supprimée avec succès de l'utilisateur" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Erreur lors de la suppression de la tâche de l'utilisateur" });
    }
});

// Route pour récupérer les tâches d'un utilisateur triées par date de deadline
app.get('/users/tasks/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).populate('tasks');
        if (!user) {
            return res.status(404).json({ msg: "Utilisateur non trouvé" });
        }
        // Tri des tâches par date de deadline (croissante)
        const sortedTasks = user.tasks.sort((a, b) => a.deadline - b.deadline);
        res.json(sortedTasks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Erreur lors de la récupération des tâches de l'utilisateur" });
    }
});

// Route pour ajouter un jour à la deadline d'une tâche
app.put('/tasks/:taskId/deadline', async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ msg: "Tâche non trouvée" });
        }

        // Ajout d'un jour à la deadline
        const currentDeadline = new Date(task.deadline);
        currentDeadline.setDate(currentDeadline.getDate() + 1);

        // Formater la nouvelle deadline en format ISO
        const newDeadlineISO = currentDeadline.toISOString();

        // Mettre à jour la deadline de la tâche dans la base de données
        await Task.findByIdAndUpdate(taskId, { deadline: newDeadlineISO });

        res.json({ msg: "Date limite de la tâche prolongée avec succès" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Erreur lors de la prolongation de la date limite de la tâche" });
    }
});


app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});
