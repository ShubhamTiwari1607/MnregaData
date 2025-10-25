document.getElementById("mgnregaForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const stateName = document.getElementById("state_name").value.trim();
  const finYear = document.getElementById("fin_year").value.trim();
  const limit = document.getElementById("limit").value.trim();
  const status = document.getElementById("status");
  const tableContainer = document.getElementById("table-container");

  if (!stateName || !finYear || !limit) {
    status.textContent = "⚠️ Please fill all fields before submitting.";
    return;
  }

  status.textContent = "⏳ Fetching data...";
  tableContainer.innerHTML = "";

  try {
    const res = await fetch(
      `/api/mgnrega?state_name=${encodeURIComponent(stateName)}&fin_year=${encodeURIComponent(finYear)}&limit=${encodeURIComponent(limit)}`
    );

    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

    const records = await res.json();

    if (!records || records.length === 0) {
      status.textContent = "No data found for the given filters.";
      return;
    }

    status.textContent = `Fetched ${records.length} records`;

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");

    Object.keys(records[0]).forEach((key) => {
      const th = document.createElement("th");
      th.textContent = key;
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    records.forEach((record) => {
      const row = document.createElement("tr");
      Object.values(record).forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        row.appendChild(td);
      });
      table.appendChild(row);
    });

    tableContainer.appendChild(table);
  } catch (error) {
    console.error(error);
    status.textContent = "Error fetching data from server.";
  }
});
