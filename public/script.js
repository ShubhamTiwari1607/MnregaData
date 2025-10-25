document.getElementById("mgnregaForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const stateName = document.getElementById("state_name").value.trim();
  const finYear = document.getElementById("fin_year").value.trim();
  const limit = document.getElementById("limit").value.trim();
  const status = document.getElementById("status");
  const tableContainer = document.getElementById("table-container");
  const mapContainer = document.getElementById("map");

  if (!stateName || !finYear || !limit) {
    status.textContent = "⚠️ Please fill all fields before submitting.";
    return;
  }

  status.innerHTML = '<span class="spinner"></span> Fetching data...';
  tableContainer.innerHTML = "";
  mapContainer.innerHTML = ""; // clear map
  mapContainer.style.height = "0px"; // reset height

  try {
    let latitude = null;
    let longitude = null;

    // Get browser location if available
    if ("geolocation" in navigator) {
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            latitude = pos.coords.latitude;
            longitude = pos.coords.longitude;
            resolve();
          },
          (err) => {
            console.warn("⚠️ Location permission denied:", err.message);
            resolve();
          }
        );
      });
    }

    // Fetch from backend
    const res = await fetch(
      `/api/mgnrega?state_name=${encodeURIComponent(stateName)}&fin_year=${encodeURIComponent(finYear)}&limit=${encodeURIComponent(limit)}&lat=${encodeURIComponent(latitude ?? "")}&lon=${encodeURIComponent(longitude ?? "")}`
    );

    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

    const data = await res.json();
    const { userLocation, recordCount, records } = data;

    status.textContent = `Fetched ${recordCount} records ${
      userLocation
        ? `(Your location: ${userLocation.lat}, ${userLocation.lon})`
        : "(Location unavailable)"
    }`;

    // Use card display for small datasets
    if (records && records.length > 0 && records.length < 5) {
      records.forEach(record => {
        const card = document.createElement("div");
        card.className = "card";
        for (const [key, value] of Object.entries(record)) {
          const p = document.createElement("p");
          p.innerHTML = `<strong>${key}:</strong> ${value}`;
          card.appendChild(p);
        }
        tableContainer.appendChild(card);
      });
      return;
    }

    // Display data as enhanced table
    if (records && records.length > 0) {
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
        Object.entries(record).forEach(([key, value]) => {
          const td = document.createElement("td");
          td.textContent = value;

          // Highlight cell when wage rate is high
          if (key === "Average_Wage_rate_per_day_per_person" && Number(value) > 270) {
            td.style.backgroundColor = "#d4f6dd";
            td.style.fontWeight = "bold";
          }
          row.appendChild(td);
        });
        table.appendChild(row);
      });

      tableContainer.appendChild(table);
    }

    // Show map if location available
    if (userLocation && userLocation.lat && userLocation.lon) {
      const { lat, lon } = userLocation;
      if (typeof L === "undefined") {
        mapContainer.style.height = "200px";
        mapContainer.innerHTML = "<p style='color: gray;'>📍 Map library not loaded. Add Leaflet JS/CSS to your HTML.</p>";
      } else {
        mapContainer.style.height = "400px";
        const map = L.map("map").setView([lat, lon], 12);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        }).addTo(map);

        const marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup("<b>You are here</b>").openPopup();
      }
    } else {
      mapContainer.style.height = "200px";
      mapContainer.innerHTML = "<p style='color: gray;'>📍 Unable to get your location.</p>";
    }

  } catch (error) {
    console.error(error);
    status.textContent = "❌ Error fetching data from server.";
  }
});
