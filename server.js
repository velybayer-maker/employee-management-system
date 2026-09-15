const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
const dataDirectory = path.join(__dirname, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });
const database = new DatabaseSync(path.join(dataDirectory, 'employees.db'));

database.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    department TEXT NOT NULL,
    role TEXT NOT NULL,
    employment_type TEXT NOT NULL CHECK (employment_type IN ('Full-time', 'Part-time', 'Contract')),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'On leave', 'Inactive')),
    start_date TEXT NOT NULL,
    location TEXT NOT NULL,
    avatar_color TEXT NOT NULL DEFAULT '#e5f0ec',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const employeeCount = database.prepare('SELECT COUNT(*) AS count FROM employees').get().count;
if (employeeCount === 0) {
  const addEmployee = database.prepare(`
    INSERT INTO employees
      (employee_code, first_name, last_name, email, phone, department, role, employment_type, status, start_date, location, avatar_color)
    VALUES (@employeeCode, @firstName, @lastName, @email, @phone, @department, @role, @employmentType, @status, @startDate, @location, @avatarColor)
  `);
  const seed = database.transaction((employees) => employees.forEach((employee) => addEmployee.run(employee)));
  seed([
    { employeeCode: 'EMP-1042', firstName: 'Alicia', lastName: 'Rivera', email: 'alicia.rivera@northstar.co', phone: '+1 (415) 555-0182', department: 'Operations', role: 'Operations Lead', employmentType: 'Full-time', status: 'Active', startDate: '2021-03-12', location: 'San Francisco, CA', avatarColor: '#d9ece5' },
    { employeeCode: 'EMP-1043', firstName: 'Marcus', lastName: 'Chen', email: 'marcus.chen@northstar.co', phone: '+1 (212) 555-0147', department: 'Engineering', role: 'Product Engineer', employmentType: 'Full-time', status: 'Active', startDate: '2022-08-22', location: 'New York, NY', avatarColor: '#f6e5bd' },
    { employeeCode: 'EMP-1044', firstName: 'Sofia', lastName: 'Bennett', email: 'sofia.bennett@northstar.co', phone: '+1 (312) 555-0136', department: 'People', role: 'People Partner', employmentType: 'Part-time', status: 'On leave', startDate: '2020-11-05', location: 'Chicago, IL', avatarColor: '#e6dced' },
    { employeeCode: 'EMP-1045', firstName: 'David', lastName: 'Okafor', email: 'david.okafor@northstar.co', phone: '+1 (206) 555-0193', department: 'Design', role: 'Senior Designer', employmentType: 'Full-time', status: 'Active', startDate: '2023-01-16', location: 'Seattle, WA', avatarColor: '#f1d8d2' },
    { employeeCode: 'EMP-1046', firstName: 'Mina', lastName: 'Patel', email: 'mina.patel@northstar.co', phone: '+1 (617) 555-0118', department: 'Finance', role: 'Financial Analyst', employmentType: 'Contract', status: 'Inactive', startDate: '2019-06-03', location: 'Boston, MA', avatarColor: '#dce6ef' }
  ]);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const employeeFields = ['employeeCode', 'firstName', 'lastName', 'email', 'phone', 'department', 'role', 'employmentType', 'status', 'startDate', 'location'];
const employeeShape = (row) => ({
  id: row.id,
  employeeCode: row.employee_code,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  phone: row.phone,
  department: row.department,
  role: row.role,
  employmentType: row.employment_type,
  status: row.status,
  startDate: row.start_date,
  location: row.location,
  avatarColor: row.avatar_color,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

function validateEmployee(body) {
  const missing = employeeFields.filter((field) => !String(body[field] || '').trim());
  if (missing.length) return `Please complete: ${missing.join(', ')}.`;
  if (!['Full-time', 'Part-time', 'Contract'].includes(body.employmentType)) return 'Choose a valid employment type.';
  if (!['Active', 'On leave', 'Inactive'].includes(body.status)) return 'Choose a valid status.';
  if (!/^\S+@\S+\.\S+$/.test(body.email)) return 'Enter a valid work email.';
  return null;
}

app.get('/api/employees', (request, response) => {
  const search = String(request.query.search || '').trim();
  const status = String(request.query.status || '').trim();
  const rows = database.prepare(`
    SELECT * FROM employees
    WHERE (@search = '' OR employee_code LIKE @term OR first_name LIKE @term OR last_name LIKE @term OR email LIKE @term OR department LIKE @term)
      AND (@status = '' OR status = @status)
    ORDER BY first_name, last_name
  `).all({ search, term: `%${search}%`, status });
  response.json(rows.map(employeeShape));
});

app.get('/api/employees/:id', (request, response) => {
  const employee = database.prepare('SELECT * FROM employees WHERE id = ?').get(request.params.id);
  if (!employee) return response.status(404).json({ error: 'Employee not found.' });
  response.json(employeeShape(employee));
});

app.post('/api/employees', (request, response) => {
  const error = validateEmployee(request.body);
  if (error) return response.status(400).json({ error });
  try {
    const result = database.prepare(`
      INSERT INTO employees (employee_code, first_name, last_name, email, phone, department, role, employment_type, status, start_date, location)
      VALUES (@employeeCode, @firstName, @lastName, @email, @phone, @department, @role, @employmentType, @status, @startDate, @location)
    `).run(request.body);
    const employee = database.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
    response.status(201).json(employeeShape(employee));
  } catch (error) {
    response.status(409).json({ error: error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'Employee code or email already exists.' : 'Unable to add employee.' });
  }
});

app.put('/api/employees/:id', (request, response) => {
  const error = validateEmployee(request.body);
  if (error) return response.status(400).json({ error });
  try {
    const result = database.prepare(`
      UPDATE employees SET employee_code=@employeeCode, first_name=@firstName, last_name=@lastName, email=@email, phone=@phone,
        department=@department, role=@role, employment_type=@employmentType, status=@status, start_date=@startDate, location=@location,
        updated_at=CURRENT_TIMESTAMP WHERE id=@id
    `).run({ ...request.body, id: request.params.id });
    if (!result.changes) return response.status(404).json({ error: 'Employee not found.' });
    const employee = database.prepare('SELECT * FROM employees WHERE id = ?').get(request.params.id);
    response.json(employeeShape(employee));
  } catch (error) {
    response.status(409).json({ error: error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'Employee code or email already exists.' : 'Unable to update employee.' });
  }
});

app.delete('/api/employees/:id', (request, response) => {
  const result = database.prepare('DELETE FROM employees WHERE id = ?').run(request.params.id);
  if (!result.changes) return response.status(404).json({ error: 'Employee not found.' });
  response.status(204).end();
});

app.use((request, response) => response.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(port, () => console.log(`Employee system running at http://localhost:${port}`));