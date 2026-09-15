const state = { employees: [], editingId: null };
const table = document.querySelector('#employeeTable');
const modal = document.querySelector('#modalBackdrop');
const form = document.querySelector('#employeeForm');
const toast = document.querySelector('#toast');

async function loadEmployees() {
  const search = document.querySelector('#searchInput').value;
  const status = document.querySelector('#statusFilter').value;
  const response = await fetch(`/api/employees.php?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`);
  state.employees = await response.json();
  render();
}

function render() {
  const department = document.querySelector('#departmentFilter').value;
  const visibleEmployees = state.employees.filter((employee) => !department || employee.department === department);
  table.innerHTML = visibleEmployees.length
    ? visibleEmployees.map((employee) => `
      <tr>
        <td>
          <div class="employee-cell">
            <span class="employee-avatar" style="background:${employee.avatarColor};color:#3f6f61">${initials(employee)}</span>
            <div>
              <div class="employee-name">${escapeHtml(employee.firstName)} ${escapeHtml(employee.lastName)}</div>
              <div class="employee-email">${escapeHtml(employee.email)}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="role">${escapeHtml(employee.role)}</div>
          <div class="department">${escapeHtml(employee.department)}</div>
        </td>
        <td><span class="employment">${escapeHtml(employee.employmentType)}</span></td>
        <td><span class="status status-${employee.status.toLowerCase().replace(' ', '-')}">${escapeHtml(employee.status)}</span></td>
        <td><span class="date">${formatDate(employee.startDate)}</span></td>
        <td>
          <div class="row-actions">
            <button data-action="view" data-id="${employee.id}" aria-label="View employee">◉</button>
            <button data-action="edit" data-id="${employee.id}" aria-label="Edit employee">✎</button>
            <button data-action="delete" data-id="${employee.id}" aria-label="Delete employee">⌫</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="empty">No employees match your filters.</td></tr>';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form));
  const method = state.editingId ? 'PUT' : 'POST';
  const endpoint = state.editingId ? `/api/employees.php?id=${state.editingId}` : '/api/employees.php';
  const response = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) {
    document.querySelector('#formError').textContent = result.error || 'Unable to save employee.';
    return;
  }
  closeModal();
  showToast(state.editingId ? 'Employee details updated.' : 'Employee added to the directory.');
  await loadEmployees();
});

table.addEventListener('click', async (event) => {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;
  const employee = state.employees.find((item) => item.id === Number(actionButton.dataset.id));
  if (actionButton.dataset.action === 'view') return openModal(employee, true);
  if (actionButton.dataset.action === 'edit') return openModal(employee);
  if (window.confirm(`Delete ${employee.firstName} ${employee.lastName}? This cannot be undone.`)) {
    await fetch(`/api/employees.php?id=${employee.id}`, { method: 'DELETE' });
    showToast('Employee removed.');
    await loadEmployees();
  }
});

loadEmployees().catch(() => {
  table.innerHTML = '<tr><td colspan="6" class="empty">Could not connect to the employee database.</td></tr>';
});