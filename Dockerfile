# Utiliser une image de base avec Node.js
FROM node:18

# Créer un répertoire de travail
WORKDIR /app

# Copier les fichiers du projet dans le conteneur
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste des fichiers du projet
COPY . .

# Exposer le port sur lequel votre application s'exécute
EXPOSE 7000

# Commande pour démarrer votre application
CMD ["npm", "start"]
