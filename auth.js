const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = path.join(__dirname, "database", "db.json");

function ensureDatabase() {
  const directory = path.dirname(DB_PATH);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(
        {
          users: [],
          tasks: [],
          taskCompletions: [],
          auditLogs: []
        },
        null,
        2
      )
    );
  }
}

function loadDatabase() {
  ensureDatabase();

  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return {
      users: [],
      tasks: [],
      taskCompletions: [],
      auditLogs: []
    };
  }
}

function saveDatabase(db) {
  ensureDatabase();

  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(db, null, 2),
    "utf8"
  );
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  try {
    const [salt, storedHash] = storedPassword.split(":");

    const derivedHash = crypto
      .scryptSync(password, salt, 64)
      .toString("hex");

    return crypto.timingSafeEqual(
      Buffer.from(storedHash, "hex"),
      Buffer.from(derivedHash, "hex")
    );
  } catch {
    return false;
  }
}

function createSession(userId) {
  return crypto.randomBytes(32).toString("hex");
}

function findUserByUsername(username) {
  const db = loadDatabase();

  return db.users.find(
    user =>
      user.username.toLowerCase() === username.toLowerCase()
  );
}

function findUserById(id) {
  const db = loadDatabase();

  return db.users.find(user => user.id === id);
}

function createUser({
  username,
  displayName,
  password,
  role = "user"
}) {
  const db = loadDatabase();

  const exists = db.users.some(
    user =>
      user.username.toLowerCase() === username.toLowerCase()
  );

  if (exists) {
    throw new Error("Username already exists.");
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    displayName,
    passwordHash: hashPassword(password),
    role,
    points: 0,
    status: "active",
    createdAt: new Date().toISOString()
  };

  db.users.push(user);

  saveDatabase(db);

  return sanitizeUser(user);
}

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    points: user.points,
    status: user.status,
    createdAt: user.createdAt
  };
}

function authenticate(username, password) {
  const user = findUserByUsername(username);

  if (!user) {
    return null;
  }

  if (user.status !== "active") {
    return null;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return null;
  }

  const session = createSession(user.id);

  return {
    session,
    user: sanitizeUser(user)
  };
}

function seedSuperAdmins() {
  const db = loadDatabase();

  const superAdmins = [
    {
      username: process.env.SUPER_ADMIN_1_USERNAME,
      password: process.env.SUPER_ADMIN_1_PASSWORD,
      displayName: "Romi"
    },
    {
      username: process.env.SUPER_ADMIN_2_USERNAME,
      password: process.env.SUPER_ADMIN_2_PASSWORD,
      displayName: "Super Admin 2"
    }
  ];

  for (const admin of superAdmins) {
    if (!admin.username || !admin.password) {
      continue;
    }

    const exists = db.users.some(
      user =>
        user.username.toLowerCase() ===
        admin.username.toLowerCase()
    );

    if (!exists) {
      db.users.push({
        id: crypto.randomUUID(),
        username: admin.username,
        displayName: admin.displayName,
        passwordHash: hashPassword(admin.password),
        role: "super_admin",
        points: 0,
        status: "active",
        createdAt: new Date().toISOString()
      });
    }
  }

  saveDatabase(db);
}

function getAllUsers() {
  const db = loadDatabase();

  return db.users.map(sanitizeUser);
}

function updateUserRole(userId, newRole) {
  const allowedRoles = [
    "user",
    "admin",
    "super_admin"
  ];

  if (!allowedRoles.includes(newRole)) {
    throw new Error("Invalid role.");
  }

  const db = loadDatabase();

  const user = db.users.find(
    item => item.id === userId
  );

  if (!user) {
    throw new Error("User not found.");
  }

  user.role = newRole;

  saveDatabase(db);

  return sanitizeUser(user);
}

function addPoints(userId, amount) {
  const db = loadDatabase();

  const user = db.users.find(
    item => item.id === userId
  );

  if (!user) {
    throw new Error("User not found.");
  }

  user.points += Number(amount) || 0;

  saveDatabase(db);

  return sanitizeUser(user);
}

function createTask(task) {
  const db = loadDatabase();

  const newTask = {
    id: crypto.randomUUID(),
    title: task.title,
    description: task.description || "",
    reward: Number(task.reward) || 0,
    type: task.type || "general",
    url: task.url || "",
    active: true,
    createdAt: new Date().toISOString()
  };

  db.tasks.push(newTask);

  saveDatabase(db);

  return newTask;
}

function getTasks() {
  const db = loadDatabase();

  return db.tasks.filter(task => task.active);
}

function completeTask(userId, taskId) {
  const db = loadDatabase();

  const task = db.tasks.find(
    item => item.id === taskId
  );

  if (!task) {
    throw new Error("Task not found.");
  }

  const alreadyCompleted =
    db.taskCompletions.some(
      item =>
        item.userId === userId &&
        item.taskId === taskId
    );

  if (alreadyCompleted) {
    throw new Error("Task already completed.");
  }

  const user = db.users.find(
    item => item.id === userId
  );

  if (!user) {
    throw new Error("User not found.");
  }

  user.points += task.reward;

  db.taskCompletions.push({
    id: crypto.randomUUID(),
    userId,
    taskId,
    reward: task.reward,
    completedAt: new Date().toISOString()
  });

  saveDatabase(db);

  return sanitizeUser(user);
}

function addAuditLog({
  actorId,
  action,
  targetId = null,
  details = ""
}) {
  const db = loadDatabase();

  db.auditLogs.unshift({
    id: crypto.randomUUID(),
    actorId,
    action,
    targetId,
    details,
    createdAt: new Date().toISOString()
  });

  db.auditLogs = db.auditLogs.slice(0, 500);

  saveDatabase(db);
}

function getAuditLogs() {
  const db = loadDatabase();

  return db.auditLogs;
}

module.exports = {
  loadDatabase,
  saveDatabase,
  createUser,
  authenticate,
  seedSuperAdmins,
  findUserById,
  getAllUsers,
  updateUserRole,
  addPoints,
  createTask,
  getTasks,
  completeTask,
  addAuditLog,
  getAuditLogs
};