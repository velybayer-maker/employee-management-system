const state = { employees: [], editingId: null };
const table = document.querySelector('#employeeTable');
const modal = document.querySelector('#modalBackdrop');
const form = document.querySelector('#employeeForm');
const toast = document.querySelector('#toast');

const loginScreen = document.querySelector('#loginScreen');
if (sessionStorage.getItem('northstar-session')) loginScreen.hidden = true;
document.querySelector('#loginForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const email = document.querySelector('#loginEmail').value;
  const password = document.querySelector('#loginPassword').value;
  if (email === 'admin@northstar.co' && password === 'northstar') {
    sessionStorage.setItem('northstar-session', 'active');
    loginScreen.hidden = true;
  } else document.querySelector('#loginError').textContent = 'Use the demo work email and password to continue.';
});

const initials = (employee) => `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase();
const formatDate = (date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));

async function loadEmployees() {
  const query = new URLSearchParams({ search: document.querySelector('#searchInput').value, status: document.querySelector('#statusFilter').value });
  const response = await fetch(`/api/employees?${query}`);
  state.employees = await response.json();
  render();
}

function render() {
  const department = document.querySelector('#departmentFilter').value;
  const visibleEmployees = state.employees.filter((employee) => !department || employee.department === department);
  table.innerHTML = visibleEmployees.length ? visibleEmployees.map((employee) => `
    <tr><td><div class="employee-cell"><span class="employee-avatar" style="background:${employee.avatarColor};color:#3f6f61">${initials(employee)}</span><div><div class="employee-name">${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}</div><div class="employee-email">${escapeHtml(employee.email)}</div></div></div></td>
    <td><div class="role">${escapeHtml(employee.role)}</div><div class="department">${escapeHtml(employee.department)}</div></td><td><span class="employment">${escapeHtml(employee.employmentType)}</span></td>
    <td><span class="status status-${employee.status.toLowerCase().replace(' ', '-')}">${escapeHtml(employee.status)}</span></td><td><span class="date">${formatDate(employee.startDate)}</span></td>
    <td><div class="row-actions"><button data-action="view" data-id="${employee.id}" aria-label="View employee">◉</button><button data-action="edit" data-id="${employee.id}" aria-label="Edit employee">✎</button><button data-action="delete" data-id="${employee.id}" aria-label="Delete employee">⌫</button></div></td></tr>`).join('') : '<tr><td colspan="6" class="empty">No employees match your filters.</td></tr>';
  document.querySelector('#resultCount').textContent = `Showing ${visibleEmployees.length} of ${state.employees.length} employees`;
  document.querySelector('#totalEmployees').textContent = state.employees.length;
  document.querySelector('#activeEmployees').textContent = state.employees.filter((employee) => employee.status === 'Active').length;
  document.querySelector('#leaveEmployees').textContent = state.employees.filter((employee) => employee.status === 'On leave').length;
  document.querySelector('#departmentCount').textContent = new Set(state.employees.map((employee) => employee.department)).size;
  const departments = [...new Set(state.employees.map((employee) => employee.department))].sort();
  const departmentFilter = document.querySelector('#departmentFilter');
  const selected = departmentFilter.value;
  departmentFilter.innerHTML = '<option value="">All departments</option>' + departments.map((departmentName) => `<option>${escapeHtml(departmentName)}</option>`).join('');
  departmentFilter.value = selected;
}

function openModal(employee = null, viewOnly = false) {
  state.editingId = employee?.id || null;
  document.querySelector('#modalEyebrow').textContent = viewOnly ? 'Employee record' : employee ? 'Update record' : 'New record';
  document.querySelector('#modalTitle').textContent = viewOnly ? `${employee.firstName} ${employee.lastName}` : employee ? 'Edit employee' : 'Add employee';
  document.querySelector('#saveEmployee').textContent = employee ? 'Save changes' : 'Save employee';
  form.reset();
  form.querySelectorAll('input, select').forEach((field) => { field.disabled = viewOnly; });
  if (employee) Object.entries(employee).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
  document.querySelector('#formError').textContent = viewOnly ? 'Close this record to return to the directory.' : '';
  document.querySelector('.modal-actions').style.display = viewOnly ? 'none' : 'flex';
  modal.hidden = false;
}

function closeModal() { modal.hidden = true; state.editingId = null; }
function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); }

document.querySelector('#addEmployeeButton').addEventListener('click', () => openModal());
document.querySelector('#closeModal').addEventListener('click', closeModal);
document.querySelector('#cancelModal').addEventListener('click', closeModal);
document.querySelector('#refreshButton').addEventListener('click', loadEmployees);
document.querySelector('#searchInput').addEventListener('input', loadEmployees);
document.querySelector('#statusFilter').addEventListener('change', loadEmployees);
document.querySelector('#departmentFilter').addEventListener('change', render);
document.querySelector('#exportButton').addEventListener('click', () => {
  const headers = ['Employee ID', 'First name', 'Last name', 'Email', 'Department', 'Role', 'Status'];
  const rows = state.employees.map((employee) => [employee.employeeCode, employee.firstName, employee.lastName, employee.email, employee.department, employee.role, employee.status]);
  const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'northstar-employees.csv'; link.click(); showToast('Employee directory exported.');
});
table.addEventListener('click', async (event) => {
  const actionButton = event.target.closest('button[data-action]'); if (!actionButton) return;
  const employee = state.employees.find((item) => item.id === Number(actionButton.dataset.id));
  if (actionButton.dataset.action === 'view') return openModal(employee, true);
  if (actionButton.dataset.action === 'edit') return openModal(employee);
  if (window.confirm(`Delete ${employee.firstName} ${employee.lastName}? This cannot be undone.`)) { await fetch(`/api/employees/${employee.id}`, { method: 'DELETE' }); showToast('Employee removed.'); await loadEmployees(); }
});
form.addEventListener('submit', async (event) => {
  event.preventDefault(); const payload = Object.fromEntries(new FormData(form)); const method = state.editingId ? 'PUT' : 'POST'; const endpoint = state.editingId ? `/api/employees/${state.editingId}` : '/api/employees';
  const response = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json();
  if (!response.ok) { document.querySelector('#formError').textContent = result.error || 'Unable to save employee.'; return; }
  closeModal(); showToast(state.editingId ? 'Employee details updated.' : 'Employee added to the directory.'); await loadEmployees();
});

loadEmployees().catch(() => { table.innerHTML = '<tr><td colspan="6" class="empty">Could not connect to the employee database.</td></tr>'; });