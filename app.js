const STORAGE_KEY = "universal_marketplace_v3";
const SUPPORTED_PROTOCOLS = ["MCP", "A2A", "OpenAI", "Anthropic", "CustomREST"];

const taskForm = document.getElementById("taskForm");
const agentForm = document.getElementById("agentForm");
const tasksContainer = document.getElementById("tasksContainer");
const taskTemplate = document.getElementById("taskTemplate");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

const actorName = document.getElementById("actorName");
const actorRole = document.getElementById("actorRole");
const kycTier = document.getElementById("kycTier");

const statTasksEl = document.getElementById("statTasks");
const statOpenEl = document.getElementById("statOpen");
const statEscrowEl = document.getElementById("statEscrow");
const statPaidEl = document.getElementById("statPaid");
const statAgentsEl = document.getElementById("statAgents");
const statCoverageEl = document.getElementById("statCoverage");

const escrowBalanceEl = document.getElementById("escrowBalance");
const totalPaidEl = document.getElementById("totalPaid");
const payoutLog = document.getElementById("payoutLog");
const auditLogEl = document.getElementById("auditLog");
const exportAuditBtn = document.getElementById("exportAudit");
const agentListEl = document.getElementById("agentList");

const appState = loadState();

function seedState() {
  const now = new Date().toISOString();
  return {
    agents: [
      {
        id: crypto.randomUUID(),
        handle: "agent-router-7",
        protocol: "MCP",
        authMethod: "OAuth2",
        capabilities: ["reasoning", "tool_use", "web_search"],
        maxConcurrency: 6,
        trustScore: 91,
        webhook: "https://agent-router.internal/webhook",
        registeredAt: now
      },
      {
        id: crypto.randomUUID(),
        handle: "agent-ops-anthropic",
        protocol: "Anthropic",
        authMethod: "API Key",
        capabilities: ["qa", "summarization"],
        maxConcurrency: 4,
        trustScore: 84,
        webhook: "",
        registeredAt: now
      }
    ],
    tasks: [
      {
        id: crypto.randomUUID(),
        postedBy: "Atlas Compliance Inc",
        posterType: "Company",
        title: "Cross-check policy mappings",
        category: "Compliance QA",
        skills: ["policy", "analysis"],
        executionMode: "hybrid",
        requiredProtocol: "MCP",
        minimumTrust: 80,
        priority: "P2-High",
        reward: 400,
        slaHours: 48,
        deadline: "2026-04-20",
        ndaRequired: "Yes",
        description: "Validate policy mapping matrix and attach justifications.",
        status: "bidding",
        assignee: "",
        bids: [],
        selectedBid: null,
        proof: "",
        kycRequired: "enhanced",
        escrowFunded: 400,
        completedAt: "",
        createdAt: now
      }
    ],
    payouts: [],
    audit: [{ time: now, message: "Platform initialized with universal agent adapter baseline." }]
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const seeded = seedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function logAudit(message) {
  appState.audit.unshift({ time: new Date().toISOString(), message });
  if (appState.audit.length > 120) appState.audit.length = 120;
}

function canAct(role) {
  return actorRole.value === role || actorRole.value === "admin";
}

function kycAllowed(task) {
  const tiers = ["restricted", "standard", "enhanced"];
  return tiers.indexOf(kycTier.value) >= tiers.indexOf(task.kycRequired || "standard");
}

function statusClass(status) {
  return `status-${status}`;
}

function isAgentCompatible(task, agent) {
  const protocolOk = task.requiredProtocol === "Any" || task.requiredProtocol === agent.protocol;
  const trustOk = Number(agent.trustScore) >= Number(task.minimumTrust || 0);
  return protocolOk && trustOk;
}

function compatibleAgentCount(task) {
  return appState.agents.filter((agent) => isAgentCompatible(task, agent)).length;
}

function render() {
  renderAgents();
  renderTasks();
  renderLedger();
  renderAudit();
  renderStats();
}

function renderAgents() {
  agentListEl.innerHTML = "";
  if (!appState.agents.length) {
    agentListEl.innerHTML = "<li>No agents registered.</li>";
    return;
  }
  appState.agents.forEach((agent) => {
    const li = document.createElement("li");
    li.textContent = `${agent.handle} | ${agent.protocol} | auth:${agent.authMethod} | trust:${agent.trustScore} | cap:${agent.capabilities.join(",")}`;
    agentListEl.appendChild(li);
  });
}

function renderTasks() {
  tasksContainer.innerHTML = "";
  const q = searchInput.value.trim().toLowerCase();
  const s = statusFilter.value;

  const filtered = appState.tasks.filter((task) => {
    const haystack = [
      task.title,
      task.category,
      task.postedBy,
      task.skills.join(" "),
      task.assignee,
      task.requiredProtocol
    ]
      .join(" ")
      .toLowerCase();
    return (!q || haystack.includes(q)) && (s === "all" || task.status === s);
  });

  if (!filtered.length) {
    tasksContainer.innerHTML = "<p>No tasks found for current filters.</p>";
  }

  filtered.forEach((task) => {
    const node = taskTemplate.content.cloneNode(true);
    node.querySelector(".task-title").textContent = `${task.title} [${task.priority}]`;

    const badge = node.querySelector(".status");
    badge.textContent = task.status.replace("_", " ");
    badge.classList.add(statusClass(task.status));

    node.querySelector(".meta").textContent =
      `Org:${task.postedBy} | Type:${task.posterType} | Mode:${task.executionMode} | Protocol:${task.requiredProtocol} | MinTrust:${task.minimumTrust} | Budget:$${task.reward} | SLA:${task.slaHours}h | Due:${task.deadline}`;
    node.querySelector(".interop").textContent =
      `Compatible registered agents: ${compatibleAgentCount(task)} / ${appState.agents.length}`;
    node.querySelector(".criteria").textContent = `Acceptance Criteria: ${task.description}`;
    node.querySelector(".assignee").textContent = task.assignee ? `Assigned to: ${task.assignee}` : "Unassigned";
    node.querySelector(".submission").textContent = task.proof ? `Submission: ${task.proof}` : "No submission";
    node.querySelector(".bids").textContent = task.bids.length
      ? `Bids: ${task.bids.map((bid) => `${bid.bidder}($${bid.amount})`).join(", ")}`
      : "Bids: none";

    const actions = node.querySelector(".actions");

    if (["open", "bidding"].includes(task.status)) {
      actions.appendChild(button("Place Bid", () => placeBid(task.id)));
      if (canAct("poster")) actions.appendChild(button("Select Bid", () => selectBid(task.id)));
      if (canAct("poster")) actions.appendChild(button("Cancel Task", () => cancelTask(task.id)));
    }

    if (task.status === "in_progress") {
      if (task.assignee === actorName.value.trim() || actorRole.value === "admin") {
        actions.appendChild(button("Submit Delivery", () => submitDelivery(task.id)));
      }
      if (canAct("poster")) actions.appendChild(button("Raise Dispute", () => disputeTask(task.id)));
    }

    if (task.status === "submitted") {
      if (canAct("poster") || canAct("finance")) {
        actions.appendChild(button("Approve for Payment", () => approvePayment(task.id)));
      }
      if (canAct("poster")) actions.appendChild(button("Request Rework", () => requestRework(task.id)));
    }

    if (task.status === "disputed" && canAct("admin")) {
      actions.appendChild(button("Resolve: Approve", () => approvePayment(task.id)));
      actions.appendChild(button("Resolve: Cancel", () => cancelTask(task.id)));
    }

    tasksContainer.appendChild(node);
  });
}

function button(text, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = text;
  btn.addEventListener("click", onClick);
  return btn;
}

function findTask(id) {
  return appState.tasks.find((task) => task.id === id);
}

function findAgent(handle) {
  return appState.agents.find((agent) => agent.handle === handle);
}

function placeBid(taskId) {
  const task = findTask(taskId);
  const bidder = actorName.value.trim();
  if (!bidder) return alert("Set actor name first.");
  if (!kycAllowed(task)) return alert(`KYC ${kycTier.value} insufficient for task requirement ${task.kycRequired}.`);

  const isAgentBid = bidder.startsWith("agent-");
  if (task.executionMode === "human" && isAgentBid) return alert("Task requires a human worker.");

  if (isAgentBid) {
    const agent = findAgent(bidder);
    if (!agent) return alert("Agent handle not registered. Use Agent Onboarding first.");
    if (!isAgentCompatible(task, agent)) {
      return alert("Agent is not compatible with task protocol/trust requirements.");
    }
  }

  const amount = Number(prompt(`Enter bid amount <= ${task.reward}`));
  if (!amount || amount <= 0 || amount > task.reward) return alert("Invalid amount.");

  task.bids = task.bids.filter((bid) => bid.bidder !== bidder);
  task.bids.push({ bidder, amount, at: new Date().toISOString(), isAgent: isAgentBid });
  task.status = "bidding";
  logAudit(`${bidder} placed bid $${amount} on '${task.title}'.`);
  persist();
  render();
}

function selectBid(taskId) {
  if (!canAct("poster")) return alert("Only poster/admin can select bids.");
  const task = findTask(taskId);
  if (!task.bids.length) return alert("No bids available.");

  const bidder = prompt(`Choose bidder: ${task.bids.map((bid) => bid.bidder).join(", ")}`);
  const bid = task.bids.find((item) => item.bidder === bidder);
  if (!bid) return alert("Bidder not found.");

  task.assignee = bid.bidder;
  task.selectedBid = bid.amount;
  task.status = "in_progress";
  logAudit(`Bid selected for '${task.title}': ${bid.bidder} at $${bid.amount}.`);
  persist();
  render();
}

function submitDelivery(taskId) {
  const task = findTask(taskId);
  const proof = prompt("Attach proof URL or delivery note:");
  if (!proof) return;
  task.proof = proof.trim();
  task.status = "submitted";
  logAudit(`${task.assignee} submitted delivery on '${task.title}'.`);
  persist();
  render();
}

function requestRework(taskId) {
  const task = findTask(taskId);
  task.status = "in_progress";
  logAudit(`Rework requested for '${task.title}'.`);
  persist();
  render();
}

function disputeTask(taskId) {
  const task = findTask(taskId);
  const reason = prompt("Dispute reason:") || "No reason supplied.";
  task.status = "disputed";
  logAudit(`Task '${task.title}' moved to disputed state. Reason: ${reason}`);
  persist();
  render();
}

function cancelTask(taskId) {
  const task = findTask(taskId);
  task.status = "cancelled";
  task.assignee = "";
  task.selectedBid = null;
  logAudit(`Task '${task.title}' cancelled; held escrow awaits reconciliation.`);
  persist();
  render();
}

function approvePayment(taskId) {
  const task = findTask(taskId);
  const amount = Number(task.selectedBid || task.reward);
  task.status = "completed";
  task.completedAt = new Date().toISOString();

  appState.payouts.unshift({
    taskId: task.id,
    title: task.title,
    payee: task.assignee || "unknown",
    amount,
    approvedBy: actorName.value.trim() || "system",
    at: task.completedAt
  });

  logAudit(`Payment approved for '${task.title}' to ${task.assignee || "unknown"}: $${amount}.`);
  persist();
  render();
}

function renderLedger() {
  const escrow = appState.tasks
    .filter((task) => !["completed"].includes(task.status))
    .reduce((sum, task) => sum + Number(task.escrowFunded || task.reward), 0);
  const paid = appState.payouts.reduce((sum, payout) => sum + Number(payout.amount), 0);

  escrowBalanceEl.textContent = `$${escrow}`;
  totalPaidEl.textContent = `$${paid}`;

  payoutLog.innerHTML = "";
  if (!appState.payouts.length) {
    payoutLog.innerHTML = "<li>No payouts released.</li>";
    return;
  }

  appState.payouts.slice(0, 60).forEach((payout) => {
    const li = document.createElement("li");
    li.textContent = `${new Date(payout.at).toLocaleString()} | ${payout.payee} earned $${payout.amount} for '${payout.title}' (approved by ${payout.approvedBy})`;
    payoutLog.appendChild(li);
  });
}

function renderAudit() {
  auditLogEl.innerHTML = "";
  appState.audit.slice(0, 60).forEach((event) => {
    const li = document.createElement("li");
    li.textContent = `${new Date(event.time).toLocaleString()} | ${event.message}`;
    auditLogEl.appendChild(li);
  });
}

function renderStats() {
  const totalTasks = appState.tasks.length;
  const openTasks = appState.tasks.filter((task) => ["open", "bidding"].includes(task.status)).length;
  const escrow = appState.tasks
    .filter((task) => task.status !== "completed")
    .reduce((sum, task) => sum + Number(task.escrowFunded || task.reward), 0);
  const paid = appState.payouts.reduce((sum, payout) => sum + Number(payout.amount), 0);

  const protocolSet = new Set(appState.agents.map((agent) => agent.protocol));
  const coverage = Math.round((protocolSet.size / SUPPORTED_PROTOCOLS.length) * 100);

  statTasksEl.textContent = String(totalTasks);
  statOpenEl.textContent = String(openTasks);
  statEscrowEl.textContent = `$${escrow}`;
  statPaidEl.textContent = `$${paid}`;
  statAgentsEl.textContent = String(appState.agents.length);
  statCoverageEl.textContent = `${coverage}%`;
}

agentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canAct("admin")) return alert("Only admin can onboard agent adapters.");

  const handle = document.getElementById("agentHandle").value.trim();
  const protocol = document.getElementById("agentProtocol").value;
  const authMethod = document.getElementById("agentAuth").value;
  const capabilities = document.getElementById("agentCapabilities").value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const maxConcurrency = Number(document.getElementById("agentConcurrency").value);
  const trustScore = Number(document.getElementById("agentTrust").value);
  const webhook = document.getElementById("agentWebhook").value.trim();

  if (!handle.startsWith("agent-")) return alert("Agent handles must start with 'agent-'.");
  if (findAgent(handle)) return alert("Agent handle already exists.");

  appState.agents.unshift({
    id: crypto.randomUUID(),
    handle,
    protocol,
    authMethod,
    capabilities,
    maxConcurrency,
    trustScore,
    webhook,
    registeredAt: new Date().toISOString()
  });

  logAudit(`Agent adapter onboarded: ${handle} (${protocol}, trust ${trustScore}).`);
  persist();
  agentForm.reset();
  render();
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canAct("poster")) return alert("Only poster/admin can create tasks.");

  const reward = Number(document.getElementById("reward").value);
  const ndaRequired = document.getElementById("ndaRequired").value;
  const requiredProtocol = document.getElementById("requiredProtocol").value;

  const task = {
    id: crypto.randomUUID(),
    postedBy: document.getElementById("postedBy").value.trim(),
    posterType: document.getElementById("posterType").value,
    title: document.getElementById("title").value.trim(),
    category: document.getElementById("category").value.trim(),
    skills: document.getElementById("skills").value.split(",").map((x) => x.trim()).filter(Boolean),
    executionMode: document.getElementById("executionMode").value,
    requiredProtocol,
    minimumTrust: Number(document.getElementById("minimumTrust").value),
    priority: document.getElementById("priority").value,
    reward,
    slaHours: Number(document.getElementById("slaHours").value),
    deadline: document.getElementById("deadline").value,
    ndaRequired,
    description: document.getElementById("description").value.trim(),
    status: "open",
    assignee: "",
    bids: [],
    selectedBid: null,
    proof: "",
    kycRequired: ndaRequired === "Yes" ? "enhanced" : "standard",
    escrowFunded: reward,
    completedAt: "",
    createdAt: new Date().toISOString()
  };

  appState.tasks.unshift(task);
  logAudit(`Task '${task.title}' created by ${task.postedBy}; required protocol=${task.requiredProtocol}; escrow funded $${reward}.`);
  persist();
  taskForm.reset();
  render();
});

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
actorName.addEventListener("input", render);
actorRole.addEventListener("change", render);
kycTier.addEventListener("change", render);

exportAuditBtn.addEventListener("click", () => {
  const payload = JSON.stringify(appState.audit, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `marketplace-audit-${new Date().toISOString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

render();
