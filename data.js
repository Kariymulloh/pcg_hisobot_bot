const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const EMPLOYEES_FILE = path.join(DATA_DIR, 'employees.json');
const REJECTED_FILE = path.join(DATA_DIR, 'rejected.json');
const DAILY_REPORTS_FILE = path.join(DATA_DIR, 'daily_reports.json');
const PENDING_FILE = path.join(DATA_DIR, 'pending.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(filePath, defaultValue = []) {
  ensureDataDir();
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Xodimlar ro'yxati (qabul qilingan foydalanuvchilar)
function getEmployees() {
  return readJson(EMPLOYEES_FILE, []);
}

function addEmployee(userId, firstName, lastName) {
  const employees = getEmployees();
  if (!employees.find(e => e.userId === userId)) {
    employees.push({ userId, firstName: firstName || '', lastName: lastName || '' });
    writeJson(EMPLOYEES_FILE, employees);
  }
}

function isEmployee(userId) {
  return getEmployees().some(e => e.userId === userId);
}

// Rad etilgan foydalanuvchilar
function getRejected() {
  return readJson(REJECTED_FILE, []);
}

function addRejected(userId) {
  const rejected = getRejected();
  if (!rejected.includes(userId)) {
    rejected.push(userId);
    writeJson(REJECTED_FILE, rejected);
  }
}

function isRejected(userId) {
  return getRejected().includes(userId);
}

// Kunlik hisobot yuborganlar
function getDailyReports() {
  return readJson(DAILY_REPORTS_FILE, {});
}

function addDailyReport(userId, date) {
  const reports = getDailyReports();
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  if (!reports[dateStr]) {
    reports[dateStr] = [];
  }
  if (!reports[dateStr].includes(userId)) {
    reports[dateStr].push(userId);
    writeJson(DAILY_REPORTS_FILE, reports);
  }
}

function getEmployeesWhoReportedToday(dateStr) {
  const reports = getDailyReports();
  return reports[dateStr] || [];
}

// Tasdiqlash kutilayotgan foydalanuvchilar
function getPending() {
  return readJson(PENDING_FILE, {});
}

function addPending(userId, firstName, lastName) {
  const pending = getPending();
  pending[userId] = { firstName, lastName };
  writeJson(PENDING_FILE, pending);
}

function getAndRemovePending(userId) {
  const pending = getPending();
  const user = pending[userId];
  if (user) {
    delete pending[userId];
    writeJson(PENDING_FILE, pending);
  }
  return user;
}

module.exports = {
  getEmployees,
  addEmployee,
  isEmployee,
  getRejected,
  addRejected,
  isRejected,
  addDailyReport,
  getEmployeesWhoReportedToday,
  addPending,
  getAndRemovePending,
};
