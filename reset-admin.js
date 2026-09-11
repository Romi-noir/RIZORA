"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_FILE = path.join(
  __dirname,
  "database",
  "db.json"
);

function hashPassword(password) {
  const salt =
    crypto.randomBytes(16).toString("hex");

  const hash =
    crypto
      .pbkdf2Sync(
        password,
        salt,
        120000,
        64,
        "sha512"
      )
      .toString("hex");

  return `${salt}:${hash}`;
}

if (!fs.existsSync(DB_FILE)) {
  console.error(
    "❌ database/db.json was not found."
  );
  process.exit(1);
}

const db =
  JSON.parse(
    fs.readFileSync(
      DB_FILE,
      "utf8"
    )
  );

const newPassword =
  "RomiRIZORA@2026!";

const admins = [
  "romi",
  "rizora"
];

let changed = 0;

for (const username of admins) {
  const user =
    db.users.find(
      (u) =>
        String(u.username)
          .toLowerCase() ===
        username
    );

  if (!user) {
    console.log(
      `⚠️ ${username} was not found.`
    );
    continue;
  }

  user.passwordHash =
    hashPassword(
      newPassword
    );

  user.role =
    "super_admin";

  user.status =
    "active";

  user.updatedAt =
    new Date().toISOString();

  changed++;

  console.log(
    `✅ Password reset for ${username}`
  );
}

fs.writeFileSync(
  DB_FILE,
  JSON.stringify(
    db,
    null,
    2
  ),
  "utf8"
);

console.log("");
console.log(
  "================================"
);
console.log(
  "RIZORA SUPER ADMIN RESET"
);
console.log(
  "================================"
);
console.log(
  `Admins updated: ${changed}`
);
console.log(
  "New password:"
);
console.log(
  newPassword
);
console.log(
  "================================"
);