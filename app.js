const storageKey = "budget-acquisti-v6";
const accessStorageKey = "otb-access-password";
const syncEndpoint = "/api/data";
const previousAreaForecastStorageKey = "budget-acquisti-v5";
const areaForecastStorageKey = "budget-acquisti-v4";
const forecastStorageKey = "budget-acquisti-v3";
const previousStorageKey = "budget-acquisti-v2";
const legacyStorageKey = "budget-acquisti-v1";

const areas = [
  { id: "store", label: "SUSI STORE", shortLabel: "Susi Store", color: "#166a5b" },
  { id: "hub", label: "SUSI HUB", shortLabel: "Susi Hub", color: "#3f6f9f" },
  { id: "estero", label: "ESTERO", shortLabel: "Estero", color: "#d8a438" }
];

const defaultBrands = ["Brand da definire"];
const brandColors = ["#166a5b", "#3f6f9f", "#d7634f", "#7a5fbb", "#d8a438", "#6f756f", "#2f7d82", "#9b5a3c"];

const state = loadState();
let accessPassword = sessionStorage.getItem(accessStorageKey) || "";
let lastRemoteSignature = JSON.stringify(state);
let isSyncingRemote = false;
let activeView = "total";
let isBrandManagerOpen = false;
let isOrderFormOpen = false;
let isBrandFormOpen = false;
const visibleForecastFields = {};
const visibleOrderDetails = {};
let saveToastTimer;

const viewTitle = document.querySelector("#viewTitle");
const accessPanel = document.querySelector("#accessPanel");
const accessForm = document.querySelector("#accessForm");
const accessPasswordInput = document.querySelector("#accessPassword");
const accessError = document.querySelector("#accessError");
const appShell = document.querySelector("#appShell");
const budgetEditor = document.querySelector("#budgetEditor");
const budgetInput = document.querySelector("#budgetInput");
const viewTabs = document.querySelector("#viewTabs");
const tabButtons = document.querySelectorAll(".tab-button");
const balanceGrid = document.querySelector("#balanceGrid");
const progressWrap = document.querySelector("#progressWrap");
const totalPanel = document.querySelector("#totalPanel");
const entryPanel = document.querySelector("#entryPanel");
const insightsPanel = document.querySelector(".insights-panel");
const brandManagerPanel = document.querySelector("#brandManagerPanel");
const purchaseForm = document.querySelector("#purchaseForm");
const purchaseName = document.querySelector("#purchaseName");
const purchaseAmount = document.querySelector("#purchaseAmount");
const purchaseBrand = document.querySelector("#purchaseBrand");
const openOrderFormButton = document.querySelector("#openOrderFormButton");
const openBrandFormButton = document.querySelector("#openBrandFormButton");
const closeOrderFormButton = document.querySelector("#closeOrderFormButton");
const filterBrand = document.querySelector("#filterBrand");
const brandForm = document.querySelector("#brandForm");
const brandInput = document.querySelector("#brandInput");
const brandForecastInputs = {
  store: document.querySelector("#brandForecastStoreInput"),
  hub: document.querySelector("#brandForecastHubInput"),
  estero: document.querySelector("#brandForecastEsteroInput")
};
const areaList = document.querySelector("#areaList");
const brandList = document.querySelector("#brandList");
const managerBrandList = document.querySelector("#managerBrandList");
const chartModeButtons = document.querySelectorAll(".chart-mode-button");
const donutChart = document.querySelector("#donutChart");
const donutLabel = document.querySelector("#donutLabel");
const donutTotal = document.querySelector("#donutTotal");
const donutLegend = document.querySelector("#donutLegend");
const budgetAmount = document.querySelector("#budgetAmount");
const spentAmount = document.querySelector("#spentAmount");
const remainingAmount = document.querySelector("#remainingAmount");
const extraMetricLabel = document.querySelector("#extraMetricLabel");
const extraMetricAmount = document.querySelector("#extraMetricAmount");
const budgetProgress = document.querySelector("#budgetProgress");
const budgetStatus = document.querySelector("#budgetStatus");
const manualRefreshButton = document.querySelector("#manualRefreshButton");
const manageBrandsButton = document.querySelector("#manageBrandsButton");
const backFromBrandsButton = document.querySelector("#backFromBrandsButton");
const exportButton = document.querySelector("#exportButton");
const floatingExportButton = document.querySelector("#floatingExportButton");
const insightsTitle = document.querySelector("#insightsTitle");
const historyTitle = document.querySelector("#historyTitle");
const areaTemplate = document.querySelector("#areaTemplate");
const saveToast = document.querySelector("#saveToast");
let chartMode = "forecast";

startApp();

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  accessError.hidden = true;
  accessPassword = accessPasswordInput.value.trim();
  const isValid = await validateAccess();

  if (!isValid) {
    accessPassword = "";
    sessionStorage.removeItem(accessStorageKey);
    accessError.hidden = false;
    accessPasswordInput.select();
    return;
  }

  sessionStorage.setItem(accessStorageKey, accessPassword);
  unlockApp();
  await syncFromRemote();
});

manualRefreshButton.addEventListener("click", async () => {
  if (!isAccessGranted() || isBrandManagerOpen || isOrderFormOpen) return;

  manualRefreshButton.disabled = true;
  manualRefreshButton.querySelector("span").textContent = "...";
  const didSync = await syncFromRemote(true);
  if (!didSync) showSaveFeedback("Aggiornamento non riuscito");
  manualRefreshButton.querySelector("span").textContent = String.fromCharCode(8635);
  manualRefreshButton.disabled = false;
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    isBrandManagerOpen = false;
    isOrderFormOpen = false;
    filterBrand.value = "all";
    render();
  });
});

chartModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    chartMode = button.dataset.chartMode;
    renderDonutChart();
  });
});

budgetInput.addEventListener("input", () => {
  if (activeView === "total") return;

  state.areas[activeView].budget = parseAmount(budgetInput.value);
  saveState();
  renderSummary();
  renderDonutChart();
  renderAreaCards();
});

purchaseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (activeView === "total") return;

  const amount = parseAmount(purchaseAmount.value);
  const name = purchaseName.value.trim();

  if (!name || amount <= 0 || !purchaseBrand.value) {
    purchaseAmount.focus();
    return;
  }

  state.areas[activeView].purchases.unshift({
    id: createId(),
    name,
    amount,
    brand: purchaseBrand.value,
    createdAt: new Date().toISOString()
  });

  purchaseForm.reset();
  purchaseBrand.value = getAreaBrands(activeView)[0] || "";
  purchaseName.focus();
  saveState(true);
  isOrderFormOpen = false;
  render();
});

brandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const brand = normalizeBrandName(brandInput.value);
  if (!brand) {
    brandInput.focus();
    return;
  }

  if (!state.brands.some((savedBrand) => savedBrand.toLowerCase() === brand.toLowerCase())) {
    state.brands.push(brand);
    state.brands.sort((a, b) => a.localeCompare(b, "it"));
  }

  areas.forEach((area) => {
    ensureBrandForecast(brand, area.id);
    const input = brandForecastInputs[area.id];
    if (input?.value.trim()) {
      setBrandForecast(brand, area.id, parseAmount(input.value));
    }
  });

  brandInput.value = "";
  Object.values(brandForecastInputs).forEach((input) => {
    input.value = "";
  });
  purchaseBrand.value = brand;
  filterBrand.value = "all";
  isBrandFormOpen = false;
  saveState(true);
  render();
});

filterBrand.addEventListener("change", () => {
  renderBrands();
});

manageBrandsButton.addEventListener("click", () => {
  isBrandManagerOpen = true;
  isBrandFormOpen = false;
  render();
});

backFromBrandsButton.addEventListener("click", () => {
  isBrandManagerOpen = false;
  isBrandFormOpen = false;
  render();
});

openBrandFormButton.addEventListener("click", () => {
  if (!isBrandManagerOpen) return;
  isBrandFormOpen = true;
  render();
  brandInput.focus();
});

openOrderFormButton.addEventListener("click", () => {
  if (activeView === "total" || isBrandManagerOpen) return;
  if (!getAreaBrands(activeView).length) {
    window.alert("Aggiungi prima un previsto per questo negozio nella gestione brand.");
    return;
  }

  isOrderFormOpen = true;
  render();
  purchaseName.focus();
});

closeOrderFormButton.addEventListener("click", () => {
  isOrderFormOpen = false;
  render();
});

exportButton.addEventListener("click", exportCsv);
floatingExportButton.addEventListener("click", exportCsv);

function exportCsv() {
  const purchases = getVisiblePurchases();
  if (!purchases.length) return;

  const rows = [
    ["Area", "Data", "Ordine", "Brand", "Previsione brand", "Importo"],
    ...purchases.map((purchase) => [
      purchase.areaLabel,
      formatDate(purchase.createdAt),
      purchase.name,
      purchase.brand,
      getBrandForecast(purchase.brand, purchase.areaId).toFixed(2).replace(".", ","),
      purchase.amount.toFixed(2).replace(".", ",")
    ])
  ];

  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = activeView === "total" ? "otb-totale.csv" : `${activeView}-ordini.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

function render() {
  renderNavigation();
  renderPanels();
  renderBrandMenus();
  renderSummary();
  renderAreaCards();
  renderManagerBrands();
  renderBrands();
}

function renderNavigation() {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeView);
  });
}

function renderPanels() {
  const isTotal = activeView === "total";
  const area = getActiveArea();

  viewTitle.textContent = isBrandManagerOpen ? "GESTIONE BRAND" : isTotal ? "TOTALE" : area.label;
  viewTabs.hidden = isBrandManagerOpen;
  balanceGrid.hidden = isBrandManagerOpen;
  progressWrap.hidden = isBrandManagerOpen;
  budgetEditor.hidden = isTotal || isBrandManagerOpen;
  manualRefreshButton.hidden = isBrandManagerOpen;
  backFromBrandsButton.hidden = !isBrandManagerOpen;
  manageBrandsButton.hidden = isBrandManagerOpen;
  brandManagerPanel.hidden = !isBrandManagerOpen;
  brandForm.hidden = !isBrandManagerOpen || !isBrandFormOpen;
  totalPanel.hidden = !isTotal || isBrandManagerOpen;
  entryPanel.hidden = isTotal || isBrandManagerOpen || !isOrderFormOpen;
  insightsPanel.hidden = isTotal || isBrandManagerOpen;
  openOrderFormButton.hidden = isTotal || isBrandManagerOpen || isOrderFormOpen;
  openBrandFormButton.hidden = !isBrandManagerOpen || isBrandFormOpen;
  floatingExportButton.hidden = isBrandManagerOpen;
  insightsTitle.textContent = isTotal ? "Brand acquistati" : `Brand ${area.shortLabel}`;
  historyTitle.textContent = "Esportazione";
  budgetInput.value = !isTotal && area ? formatInputAmount(state.areas[area.id].budget) : "";
}

function renderSummary() {
  const summary = getSummary(activeView);
  const progress = summary.budget > 0 ? Math.min((summary.spent / summary.budget) * 100, 100) : 0;

  budgetAmount.textContent = formatCurrency(summary.budget);
  spentAmount.textContent = formatCurrency(summary.spent);
  remainingAmount.textContent = formatCurrency(summary.remaining);
  extraMetricLabel.textContent = "Previsione";
  extraMetricAmount.textContent = formatCurrency(summary.forecast);
  budgetProgress.style.width = `${progress}%`;
  budgetProgress.style.background = summary.spent > summary.budget && summary.budget > 0 ? "var(--coral)" : "var(--green)";

  if (!summary.budget) {
    budgetStatus.textContent = activeView === "total"
      ? "Imposta i valori nelle tre aree per vedere il totale."
      : "Imposta un OTB per questa area.";
  } else if (summary.remaining >= 0) {
    budgetStatus.textContent = `Disponibili ${formatCurrency(summary.remaining)}.`;
  } else {
    budgetStatus.textContent = `OTB superato di ${formatCurrency(Math.abs(summary.remaining))}.`;
  }
}

function renderAreaCards() {
  areaList.innerHTML = "";

  areas.forEach((area) => {
    const summary = getSummary(area.id);
    const available = summary.forecast - summary.spent;
    const progress = summary.forecast > 0 ? Math.min((summary.spent / summary.forecast) * 100, 100) : 0;
    const card = areaTemplate.content.firstElementChild.cloneNode(true);
    const button = card.querySelector(".area-card-button");

    card.style.setProperty("--area-color", area.color);
    card.querySelector(".area-title").textContent = area.shortLabel;
    card.querySelector(".area-meta").textContent = `${formatCurrency(summary.spent)} ordinati su ${formatCurrency(summary.forecast)}`;
    card.querySelector(".area-remaining").textContent = `Disp. ${formatCurrency(available)}`;
    card.querySelector(".area-progress div").style.width = `${progress}%`;
    card.querySelector(".area-progress div").style.background = summary.spent > summary.forecast && summary.forecast > 0
      ? "var(--coral)"
      : area.color;

    button.addEventListener("click", () => {
      activeView = area.id;
      filterBrand.value = "all";
      render();
    });

    areaList.append(card);
  });
}

function renderDonutChart() {
  chartModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.chartMode === chartMode);
  });

  const values = areas.map((area) => {
    const summary = getSummary(area.id);
    return {
      ...area,
      value: chartMode === "forecast" ? summary.forecast : summary.spent
    };
  });
  const total = values.reduce((sum, area) => sum + area.value, 0);
  let cursor = 0;
  const stops = values.map((area) => {
    const start = total > 0 ? (cursor / total) * 100 : 0;
    cursor += area.value;
    const end = total > 0 ? (cursor / total) * 100 : 0;
    return `${area.color} ${start}% ${end}%`;
  });

  donutChart.style.background = total > 0
    ? `conic-gradient(${stops.join(", ")})`
    : "#e8e1d5";
  donutLabel.textContent = chartMode === "forecast" ? "Previsto" : "Ordinato";
  donutTotal.textContent = formatCurrency(total);
  donutLegend.innerHTML = values.map((area) => {
    const percentage = total > 0 ? Math.round((area.value / total) * 100) : 0;
    return `
      <div class="legend-row">
        <span style="background:${area.color}"></span>
        <strong>${escapeHtml(area.shortLabel)}</strong>
        <em>${percentage}%</em>
        <small>${formatCurrency(area.value)}</small>
      </div>
    `;
  }).join("");
}

function renderBrandMenus() {
  const areaBrands = activeView === "total" ? state.brands : getAreaBrands(activeView);
  const selectedPurchaseBrand = purchaseBrand.value || areaBrands[0] || "";
  const selectedFilterBrand = filterBrand.value || "all";
  purchaseBrand.innerHTML = "";
  filterBrand.innerHTML = '<option value="all">Tutti i brand</option>';

  state.brands.forEach((brand) => {
    areas.forEach((area) => ensureBrandForecast(brand, area.id));
  });

  areaBrands.forEach((brand) => {
    purchaseBrand.add(new Option(brand, brand));
    filterBrand.add(new Option(brand, brand));
  });

  purchaseBrand.value = areaBrands.includes(selectedPurchaseBrand) ? selectedPurchaseBrand : areaBrands[0] || "";
  filterBrand.value = selectedFilterBrand === "all" || areaBrands.includes(selectedFilterBrand) ? selectedFilterBrand : "all";
}

function renderBrands() {
  brandList.innerHTML = "";
  const totals = getBrandTotals();
  const selectedBrand = filterBrand.value;
  const visibleBrands = getAreaBrands(activeView)
    .filter((brand) => selectedBrand === "all" || brand === selectedBrand)
    .map((brand) => [brand, totals[brand] || 0])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"));

  visibleBrands
    .forEach(([brand, total], index) => {
      const forecast = getBrandForecast(brand, activeView);
      const orders = getPurchasesForBrand(activeView, brand);
      const isDetailVisible = Boolean(visibleOrderDetails[activeView]?.[brand]);
      const available = forecast - total;
      const progress = forecast > 0 ? Math.min((total / forecast) * 100, 100) : 0;
      const status = getBrandStatus(total, forecast);
      const row = document.createElement("div");
      row.className = `brand-row-item ${status.className}`;
      row.style.color = getBrandColor(brand, index);
      row.innerHTML = `
        <span></span>
        <div class="brand-row-main">
          <div class="brand-heading">
            <strong>${escapeHtml(brand)}</strong>
          </div>
          <div class="brand-bar"><div style="width: ${progress}%"></div></div>
          <div class="brand-values">
            <span><small>Previsto</small><strong>${formatCurrency(forecast)}</strong></span>
            <span><small>Ordinato</small><strong>${formatCurrency(total)}</strong></span>
            <span><small>Disponibile</small><strong>${formatCurrency(available)}</strong></span>
          </div>
          <button class="order-detail-toggle" type="button">${isDetailVisible ? "Nascondi ordini" : "Dettaglio ordini"} (${orders.length})</button>
          <div class="order-detail-list" ${isDetailVisible ? "" : "hidden"}>
            ${orders.length ? orders.map((purchase) => renderOrderItem(purchase)).join("") : '<p class="empty-state compact-empty">Nessun ordine inserito.</p>'}
          </div>
        </div>
      `;
      row.querySelector(".order-detail-toggle").addEventListener("click", () => {
        toggleOrderDetails(activeView, brand);
      });
      row.querySelectorAll(".order-edit-button").forEach((button) => {
        button.addEventListener("click", () => {
          const item = button.closest(".order-item");
          item.querySelector(".order-edit-form").hidden = false;
          item.querySelector(".order-edit-name").focus();
        });
      });
      row.querySelectorAll(".order-save-button").forEach((button) => {
        button.addEventListener("click", () => {
          const item = button.closest(".order-item");
          savePurchaseEdit(activeView, item.dataset.purchaseId, {
            name: item.querySelector(".order-edit-name").value,
            amount: item.querySelector(".order-edit-amount").value,
            brand: item.querySelector(".order-edit-brand").value
          });
        });
      });
      row.querySelectorAll(".order-delete-button").forEach((button) => {
        button.addEventListener("click", () => {
          deletePurchase(activeView, button.closest(".order-item").dataset.purchaseId);
        });
      });
      brandList.append(row);
    });

  if (!brandList.children.length) {
    brandList.innerHTML = '<p class="empty-state">Nessun brand collegato a questo negozio.</p>';
  }
}

function renderManagerBrands() {
  managerBrandList.innerHTML = "";

  state.brands.forEach((brand) => {
    const item = document.createElement("div");
    item.className = "manager-brand-item";
    item.innerHTML = `
      <div class="manager-brand-heading">
        <strong>${escapeHtml(brand)}</strong>
        <div class="brand-actions">
          <button class="brand-edit-button" type="button">Modifica</button>
          <button class="brand-delete-button" type="button" aria-label="Elimina brand">x</button>
        </div>
      </div>
      <div class="brand-name-editor" hidden>
        <input autocomplete="off" value="${escapeAttribute(brand)}" aria-label="Nome brand">
        <button class="brand-save-button" type="button">Salva</button>
      </div>
      <div class="manager-area-add" hidden>
        <select aria-label="Aggiungi previsto negozio">
          ${areas.map((area) => `<option value="${area.id}">${escapeHtml(area.shortLabel)}</option>`).join("")}
        </select>
        <button class="text-button" type="button">Aggiungi previsto</button>
      </div>
      <div class="area-forecast-list">
        ${areas.filter((area) => shouldShowForecastField(brand, area.id)).map((area) => `
          <label class="forecast-field">
            <span>${escapeHtml(area.shortLabel)}</span>
            <span class="forecast-editor">
              <span class="money-input mini"><span>&euro;</span><input inputmode="decimal" autocomplete="off" value="${formatInputAmount(getBrandForecast(brand, area.id))}" data-area="${area.id}" data-brand="${escapeAttribute(brand)}"></span>
              <button class="forecast-save-button" type="button" hidden>Salva</button>
            </span>
          </label>
        `).join("")}
      </div>
    `;

    item.querySelector(".brand-edit-button").addEventListener("click", () => {
      const editor = item.querySelector(".brand-name-editor");
      const areaAdd = item.querySelector(".manager-area-add");
      const input = editor.querySelector("input");
      editor.hidden = false;
      areaAdd.hidden = false;
      input.focus();
      input.select();
    });
    item.querySelector(".brand-save-button").addEventListener("click", () => {
      renameBrand(brand, item.querySelector(".brand-name-editor input").value);
    });
    item.querySelector(".brand-name-editor input").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        renameBrand(brand, event.target.value);
      }
    });
    item.querySelector(".manager-area-add button").addEventListener("click", () => {
      const areaId = item.querySelector(".manager-area-add select").value;
      showForecastField(brand, areaId);
      saveState();
      render();
      const input = managerBrandList.querySelector(`input[data-area="${areaId}"]`);
      input?.focus();
    });
    item.querySelector(".brand-delete-button").addEventListener("click", () => {
      deleteBrand(brand);
    });
    item.querySelectorAll(".forecast-field").forEach((field) => {
      const forecastInput = field.querySelector("input");
      const forecastSaveButton = field.querySelector(".forecast-save-button");
      const areaId = forecastInput.dataset.area;

      forecastSaveButton.addEventListener("click", () => {
        setBrandForecast(brand, areaId, parseAmount(forecastInput.value));
        forecastInput.value = formatInputAmount(getBrandForecast(brand, areaId));
        forecastSaveButton.hidden = true;
        saveState(true);
        render();
      });
      forecastInput.addEventListener("change", (event) => {
        setBrandForecast(brand, areaId, parseAmount(event.target.value));
        event.target.value = formatInputAmount(getBrandForecast(brand, areaId));
        forecastSaveButton.hidden = true;
        saveState(true);
        render();
      });
      forecastInput.addEventListener("input", (event) => {
        const nextValue = parseAmount(event.target.value);
        forecastSaveButton.hidden = nextValue === getBrandForecast(brand, areaId);
      });
    });

    if (!item.querySelector(".forecast-field")) {
      const empty = document.createElement("p");
      empty.className = "empty-state compact-empty";
      empty.textContent = "Nessun previsto inserito.";
      item.querySelector(".area-forecast-list").append(empty);
    }

    managerBrandList.append(item);
  });
}

function getPurchasesForBrand(areaId, brand) {
  if (!state.areas[areaId]) return [];

  return enrichPurchases(areaId).filter((purchase) => purchase.brand === brand);
}

function renderOrderItem(purchase) {
  const brandOptions = state.brands.map((brand) => {
    const selected = brand === purchase.brand ? " selected" : "";
    return `<option value="${escapeAttribute(brand)}"${selected}>${escapeHtml(brand)}</option>`;
  }).join("");

  return `
    <article class="order-item" data-purchase-id="${escapeAttribute(purchase.id)}">
      <div>
        <strong>${escapeHtml(purchase.name)}</strong>
        <p>${formatDate(purchase.createdAt)} - ${escapeHtml(purchase.brand)}</p>
      </div>
      <strong>${formatCurrency(purchase.amount)}</strong>
      <div class="order-actions">
        <button class="brand-edit-button order-edit-button" type="button">Modifica</button>
        <button class="brand-delete-button order-delete-button" type="button" aria-label="Elimina ordine">x</button>
      </div>
      <div class="order-edit-form" hidden>
        <input class="order-edit-name" autocomplete="off" value="${escapeAttribute(purchase.name)}" aria-label="Nome ordine">
        <span class="money-input mini"><span>&euro;</span><input class="order-edit-amount" inputmode="decimal" autocomplete="off" value="${formatInputAmount(purchase.amount)}" aria-label="Importo ordine"></span>
        <select class="order-edit-brand" aria-label="Brand ordine">${brandOptions}</select>
        <button class="order-save-button" type="button">Salva</button>
      </div>
    </article>
  `;
}

function toggleOrderDetails(areaId, brand) {
  if (!visibleOrderDetails[areaId]) {
    visibleOrderDetails[areaId] = {};
  }

  visibleOrderDetails[areaId][brand] = !visibleOrderDetails[areaId][brand];
  renderBrands();
}

function savePurchaseEdit(areaId, purchaseId, data) {
  const purchase = state.areas[areaId]?.purchases.find((item) => item.id === purchaseId);
  if (!purchase) return;

  const amount = parseAmount(data.amount);
  const name = String(data.name).trim();
  if (!name || amount <= 0) return;

  purchase.name = name;
  purchase.amount = amount;
  purchase.brand = data.brand;
  saveState(true);
  render();
}

function deletePurchase(areaId, purchaseId) {
  const confirmed = window.confirm("Vuoi eliminare questo ordine?");
  if (!confirmed) return;

  state.areas[areaId].purchases = state.areas[areaId].purchases.filter((purchase) => purchase.id !== purchaseId);
  saveState(true);
  render();
}

function getVisiblePurchases() {
  const selectedBrand = filterBrand.value;
  const purchases = activeView === "total"
    ? areas.flatMap((area) => enrichPurchases(area.id))
    : enrichPurchases(activeView);

  return purchases.filter((purchase) => selectedBrand === "all" || purchase.brand === selectedBrand);
}

function getAreaBrands(areaId) {
  if (areaId === "total") return state.brands;

  const orderedBrands = new Set(
    state.areas[areaId].purchases.map((purchase) => purchase.brand || purchase.category || defaultBrands[0])
  );

  return state.brands.filter((brand) => getBrandForecast(brand, areaId) > 0 || orderedBrands.has(brand));
}

function enrichPurchases(areaId) {
  const area = areas.find((item) => item.id === areaId);
  return state.areas[areaId].purchases.map((purchase) => ({
    ...purchase,
    brand: purchase.brand || purchase.category || defaultBrands[0],
    areaId,
    areaLabel: area.shortLabel
  }));
}

function getBrandTotals() {
  return getVisiblePurchases().reduce((totals, purchase) => {
    totals[purchase.brand] = (totals[purchase.brand] || 0) + purchase.amount;
    return totals;
  }, {});
}

function getSummary(viewId) {
  const selectedAreas = viewId === "total" ? areas : [getActiveArea(viewId)];
  const summary = selectedAreas.reduce((totals, area) => {
    const budget = state.areas[area.id].budget;
    const spent = getTotal(state.areas[area.id].purchases);

    totals.budget += budget;
    totals.spent += spent;
    totals.count += state.areas[area.id].purchases.length;
    totals.remaining = totals.budget - totals.spent;
    return totals;
  }, { budget: 0, spent: 0, remaining: 0, count: 0 });

  summary.forecast = getForecastTotal(viewId);
  return summary;
}

function getActiveArea(viewId = activeView) {
  return areas.find((area) => area.id === viewId);
}

function getTotal(purchases) {
  return purchases.reduce((sum, purchase) => sum + purchase.amount, 0);
}

function parseAmount(value) {
  const cleanValue = String(value).replace(/[^\d.,]/g, "");
  const normalized = cleanValue.includes(",")
    ? cleanValue.replace(/\./g, "").replace(",", ".")
    : cleanValue;
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

function formatInputAmount(value) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function loadState() {
  const freshState = {
    brands: [...defaultBrands],
    brandForecasts: createForecastMap(defaultBrands),
    areas: areas.reduce((savedAreas, area) => {
      savedAreas[area.id] = { budget: 0, purchases: [] };
      return savedAreas;
    }, {})
  };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.areas) {
      freshState.brands = normalizeBrands(saved.brands);
      freshState.brandForecasts = createForecastMap(freshState.brands, saved.brandForecasts);
      areas.forEach((area) => {
        freshState.areas[area.id] = {
          budget: Number(saved.areas[area.id]?.budget) || 0,
          purchases: normalizePurchases(saved.areas[area.id]?.purchases)
        };
      });
      return freshState;
    }

    const previousAreaForecastState = JSON.parse(localStorage.getItem(previousAreaForecastStorageKey));
    if (previousAreaForecastState?.areas) {
      freshState.brands = normalizeBrands(previousAreaForecastState.brands);
      freshState.brandForecasts = createForecastMap(freshState.brands, previousAreaForecastState.brandForecasts);
      areas.forEach((area) => {
        freshState.areas[area.id] = {
          budget: Number(previousAreaForecastState.areas[area.id]?.budget) || 0,
          purchases: normalizePurchases(previousAreaForecastState.areas[area.id]?.purchases)
        };
      });
      return freshState;
    }

    const areaForecastState = JSON.parse(localStorage.getItem(areaForecastStorageKey));
    if (areaForecastState?.areas) {
      freshState.brands = normalizeBrands(areaForecastState.brands);
      freshState.brandForecasts = createForecastMap(freshState.brands, areaForecastState.brandForecasts);
      areas.forEach((area) => {
        freshState.areas[area.id] = {
          budget: Number(areaForecastState.areas[area.id]?.budget) || 0,
          purchases: normalizePurchases(areaForecastState.areas[area.id]?.purchases)
        };
      });
      return freshState;
    }

    const forecastState = JSON.parse(localStorage.getItem(forecastStorageKey));
    if (forecastState?.areas) {
      freshState.brands = normalizeBrands(forecastState.brands);
      freshState.brandForecasts = createForecastMap(freshState.brands, forecastState.brandForecasts);
      areas.forEach((area) => {
        freshState.areas[area.id] = {
          budget: Number(forecastState.areas[area.id]?.budget) || 0,
          purchases: normalizePurchases(forecastState.areas[area.id]?.purchases)
        };
      });
      return freshState;
    }

    const previous = JSON.parse(localStorage.getItem(previousStorageKey));
    if (previous?.areas) {
      const migratedBrands = [];
      areas.forEach((area) => {
        const purchases = normalizePurchases(previous.areas[area.id]?.purchases);
        freshState.areas[area.id] = {
          budget: Number(previous.areas[area.id]?.budget) || 0,
          purchases
        };
        purchases.forEach((purchase) => migratedBrands.push(purchase.brand));
      });
      freshState.brands = normalizeBrands(migratedBrands);
      freshState.brandForecasts = createForecastMap(freshState.brands);
      return freshState;
    }

    const legacy = JSON.parse(localStorage.getItem(legacyStorageKey));
    if (legacy) {
      const purchases = normalizePurchases(legacy.purchases);
      freshState.areas.store = {
        budget: Number(legacy.budget) || 0,
        purchases
      };
      freshState.brands = normalizeBrands(purchases.map((purchase) => purchase.brand));
      freshState.brandForecasts = createForecastMap(freshState.brands);
    }
  } catch {
    return freshState;
  }

  return freshState;
}

function saveState(showFeedback = false) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  lastRemoteSignature = JSON.stringify(state);
  syncToRemote(showFeedback);
}

async function startApp() {
  if (isLocalPreview()) {
    unlockApp();
    syncFromRemote();
    return;
  }

  if (accessPassword && await validateAccess()) {
    unlockApp();
    await syncFromRemote();
    return;
  }

  sessionStorage.removeItem(accessStorageKey);
  accessPassword = "";
  appShell.hidden = true;
  accessPanel.hidden = false;
  accessPasswordInput.focus();
}

function unlockApp() {
  accessPanel.hidden = true;
  appShell.hidden = false;
  floatingExportButton.hidden = false;
  openOrderFormButton.hidden = false;
  openBrandFormButton.hidden = true;
  render();
}

function isAccessGranted() {
  return isLocalPreview() || Boolean(accessPassword);
}

function isLocalPreview() {
  return location.protocol === "file:"
    || location.hostname === "localhost"
    || location.hostname === "127.0.0.1"
    || location.hostname.startsWith("192.168.")
    || location.hostname.startsWith("10.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(location.hostname);
}

function getAccessHeaders(extraHeaders = {}) {
  return {
    ...extraHeaders,
    "X-OTB-Access": accessPassword
  };
}

async function validateAccess() {
  if (isLocalPreview()) return true;

  try {
    const response = await fetchWithTimeout(syncEndpoint, {
      cache: "no-store",
      headers: getAccessHeaders()
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function syncFromRemote(showFeedback = false) {
  if (isSyncingRemote || isLocalPreview() || !accessPassword) return false;

  isSyncingRemote = true;
  try {
    const response = await fetchWithTimeout(syncEndpoint, {
      cache: "no-store",
      headers: getAccessHeaders()
    });
    if (!response.ok) return false;

    const payload = await response.json();
    if (!payload.data) {
      await syncToRemote();
      return true;
    }

    const normalized = normalizeLoadedState(payload.data);
    const nextSignature = JSON.stringify(normalized);
    if (nextSignature === lastRemoteSignature) {
      if (showFeedback) showSaveFeedback("Aggiornato");
      return true;
    }

    applyLoadedState(normalized);
    localStorage.setItem(storageKey, JSON.stringify(state));
    lastRemoteSignature = nextSignature;
    render();
    if (showFeedback) showSaveFeedback("Aggiornato");
    return true;
  } catch {
    // Offline or local preview: keep using local data.
    return false;
  } finally {
    isSyncingRemote = false;
  }
}

async function syncToRemote(showFeedback = false) {
  if (isLocalPreview() || !accessPassword) {
    if (showFeedback) showSaveFeedback("Salvato sul dispositivo");
    return false;
  }

  try {
    const response = await fetchWithTimeout(syncEndpoint, {
      method: "POST",
      headers: getAccessHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(state)
    });

    if (!response.ok) {
      if (showFeedback) showSaveFeedback("Non salvato online");
      return false;
    }

    if (showFeedback) showSaveFeedback("Salvato online");
    return true;
  } catch {
    // If the remote endpoint is not available yet, local storage remains the source.
    if (showFeedback) showSaveFeedback("Non salvato online");
    return false;
  }
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeLoadedState(saved) {
  const normalized = {
    brands: normalizeBrands(saved?.brands),
    brandForecasts: {},
    areas: areas.reduce((savedAreas, area) => {
      savedAreas[area.id] = {
        budget: Number(saved?.areas?.[area.id]?.budget) || 0,
        purchases: normalizePurchases(saved?.areas?.[area.id]?.purchases)
      };
      return savedAreas;
    }, {})
  };
  normalized.brandForecasts = createForecastMap(normalized.brands, saved?.brandForecasts);
  return normalized;
}

function applyLoadedState(nextState) {
  state.brands = nextState.brands;
  state.brandForecasts = nextState.brandForecasts;
  areas.forEach((area) => {
    state.areas[area.id] = nextState.areas[area.id];
  });
}

function showSaveFeedback(message = "Salvato") {
  window.clearTimeout(saveToastTimer);
  saveToast.textContent = message;
  saveToast.hidden = false;
  saveToastTimer = window.setTimeout(() => {
    saveToast.hidden = true;
  }, 1500);
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeBrandName(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

function normalizeBrands(brands) {
  const cleanBrands = Array.isArray(brands)
    ? brands.map(normalizeBrandName).filter(Boolean)
    : [];
  const uniqueBrands = [...new Map([...defaultBrands, ...cleanBrands].map((brand) => [brand.toLowerCase(), brand])).values()];
  return uniqueBrands.sort((a, b) => a.localeCompare(b, "it"));
}

function createForecastMap(brands, savedForecasts = {}) {
  return areas.reduce((forecasts, area, areaIndex) => {
    forecasts[area.id] = brands.reduce((areaForecasts, brand) => {
      const areaSaved = savedForecasts?.[area.id]?.[brand];
      const legacySaved = areaIndex === 0 ? savedForecasts?.[brand] : 0;
      areaForecasts[brand] = Number(areaSaved ?? legacySaved) || 0;
      return areaForecasts;
    }, {});
    return forecasts;
  }, {});
}

function ensureBrandForecast(brand, areaId = activeView) {
  const targetArea = areas.some((area) => area.id === areaId) ? areaId : areas[0].id;
  if (!state.brandForecasts[targetArea]) {
    state.brandForecasts[targetArea] = {};
  }

  if (!Object.prototype.hasOwnProperty.call(state.brandForecasts[targetArea], brand)) {
    state.brandForecasts[targetArea][brand] = 0;
  }
}

function getBrandForecast(brand, areaId = activeView) {
  const targetArea = areas.some((area) => area.id === areaId) ? areaId : areas[0].id;
  ensureBrandForecast(brand, targetArea);
  return Number(state.brandForecasts[targetArea][brand]) || 0;
}

function setBrandForecast(brand, areaId, value) {
  ensureBrandForecast(brand, areaId);
  state.brandForecasts[areaId][brand] = Number(value) || 0;
}

function getForecastTotal(viewId = activeView) {
  const selectedAreas = viewId === "total" ? areas : [getActiveArea(viewId)];
  return selectedAreas.reduce((areaTotal, area) => {
    return areaTotal + state.brands.reduce((brandTotal, brand) => brandTotal + getBrandForecast(brand, area.id), 0);
  }, 0);
}

function shouldShowForecastField(brand, areaId) {
  return getBrandForecast(brand, areaId) > 0 || Boolean(visibleForecastFields[brand]?.[areaId]);
}

function showForecastField(brand, areaId) {
  if (!visibleForecastFields[brand]) {
    visibleForecastFields[brand] = {};
  }
  visibleForecastFields[brand][areaId] = true;
}

function deleteBrand(brand) {
  const usedCount = areas.reduce((count, area) => {
    return count + state.areas[area.id].purchases.filter((purchase) => purchase.brand === brand).length;
  }, 0);
  const message = usedCount > 0
    ? `Vuoi eliminare ${brand} dalla lista brand? Gli ordini gia inseriti resteranno nello storico.`
    : `Vuoi eliminare ${brand} dalla lista brand?`;

  if (!window.confirm(message)) return;

  state.brands = state.brands.filter((savedBrand) => savedBrand !== brand);
  areas.forEach((area) => {
    delete state.brandForecasts[area.id]?.[brand];
  });

  if (!state.brands.length) {
    state.brands = [...defaultBrands];
    state.brandForecasts = createForecastMap(state.brands);
  }

  purchaseBrand.value = state.brands[0];
  filterBrand.value = "all";
  saveState(true);
  render();
}

function renameBrand(oldBrand, rawName) {
  const newBrand = normalizeBrandName(rawName);
  if (!newBrand || newBrand === oldBrand) return;

  const alreadyExists = state.brands.some((brand) => brand.toLowerCase() === newBrand.toLowerCase() && brand !== oldBrand);
  if (alreadyExists) {
    window.alert("Esiste gia un brand con questo nome.");
    return;
  }

  const forecasts = areas.reduce((savedForecasts, area) => {
    savedForecasts[area.id] = getBrandForecast(oldBrand, area.id);
    return savedForecasts;
  }, {});
  state.brands = state.brands.map((brand) => brand === oldBrand ? newBrand : brand);
  state.brands.sort((a, b) => a.localeCompare(b, "it"));
  areas.forEach((area) => {
    delete state.brandForecasts[area.id]?.[oldBrand];
    setBrandForecast(newBrand, area.id, forecasts[area.id]);
  });

  areas.forEach((area) => {
    state.areas[area.id].purchases = state.areas[area.id].purchases.map((purchase) => ({
      ...purchase,
      brand: purchase.brand === oldBrand ? newBrand : purchase.brand
    }));
  });

  purchaseBrand.value = newBrand;
  filterBrand.value = "all";
  saveState(true);
  render();
}

function getBrandStatus(ordered, forecast) {
  if (forecast <= 0) {
    return { className: "status-neutral", label: "Inserisci un valore previsto" };
  }

  const ratio = ordered / forecast;
  if (ratio > 1) {
    return { className: "status-red", label: "Previsto superato" };
  }

  if (ratio > 0.8) {
    return { className: "status-orange", label: "Oltre 80% del previsto" };
  }

  return { className: "status-green", label: "Entro 80% del previsto" };
}

function normalizePurchases(purchases) {
  if (!Array.isArray(purchases)) return [];

  return purchases.map((purchase) => ({
    ...purchase,
    brand: normalizeBrandName(purchase.brand || purchase.category || defaultBrands[0])
  }));
}

function getBrandColor(brand, fallbackIndex = 0) {
  const index = state.brands.findIndex((savedBrand) => savedBrand === brand);
  const colorIndex = index >= 0 ? index : fallbackIndex;
  return brandColors[colorIndex % brandColors.length];
}
