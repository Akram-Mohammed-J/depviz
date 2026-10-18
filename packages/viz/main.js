let network = null;
let graphData = null; // { nodes: [...], edges: [...] }
let reverseAdjacency = new Map(); // id -> [parent ids]
let rootIds = new Set();

function buildReverseAdjacency(data) {
  const reverse = new Map();
  for (const node of data.nodes) reverse.set(node.id, []);
  for (const edge of data.edges) {
    const parents = reverse.get(edge.to);
    if (parents) parents.push(edge.from);
  }
  return reverse;
}

function findIntroducingPaths(targetId) {
  const paths = [];

  function walk(nodeId, pathSoFar, visited) {
    if (rootIds.has(nodeId)) {
      paths.push([nodeId, ...pathSoFar]);
      return;
    }
    const parents = reverseAdjacency.get(nodeId) ?? [];
    if (parents.length === 0) {
      paths.push([nodeId, ...pathSoFar]);
      return;
    }
    for (const parent of parents) {
      if (visited.has(parent)) continue;
      walk(parent, [nodeId, ...pathSoFar], new Set(visited).add(parent));
    }
  }

  walk(targetId, [], new Set([targetId]));
  return paths;
}

function colorFor(node) {
  if (node.vulnerabilities?.length) return "#e74c3c";
  if (node.isRoot) return "#3498db";
  return "#95a5a6";
}

function renderGraph(data) {
  graphData = data;
  reverseAdjacency = buildReverseAdjacency(data);
  rootIds = new Set(data.nodes.filter((n) => n.isRoot).map((n) => n.id));

  const nodes = new vis.DataSet(
    data.nodes.map((n) => ({
      id: n.id,
      label: `${n.name}\n${n.version}`,
      color: colorFor(n),
      shape: n.isRoot ? "box" : "ellipse",
    })),
  );
  const edges = new vis.DataSet(
    data.edges.map((e, i) => ({ id: i, from: e.from, to: e.to, arrows: "to" })),
  );

  const container = document.getElementById("network");
  network = new vis.Network(
    container,
    { nodes, edges },
    {
      layout: { hierarchical: { direction: "UD", sortMethod: "directed" } },
      physics: false,
      edges: { color: "#ccc" },
    },
  );

  network.on("click", (params) => {
    if (params.nodes.length === 0) {
      edges.update(data.edges.map((e, i) => ({ id: i, color: "#ccc", width: 1 })));
      document.getElementById("sidebar").style.display = "none";
      return;
    }
    showNodeDetails(params.nodes[0], edges);
  });
}

function showNodeDetails(nodeId, edgesDataSet) {
  const node = graphData.nodes.find((n) => n.id === nodeId);
  const sidebar = document.getElementById("sidebar");
  const title = document.getElementById("sidebarTitle");
  const vulnsEl = document.getElementById("sidebarVulns");
  const pathsEl = document.getElementById("sidebarPaths");

  title.textContent = `${node.name}@${node.version}`;

  vulnsEl.innerHTML = node.vulnerabilities?.length
    ? node.vulnerabilities.map((v) => `<div><strong>${v.id}</strong>${v.severity ? ` (sev ${v.severity})` : ""}<br/>${v.summary}</div>`).join("<hr/>")
    : "<em>No known vulnerabilities</em>";

  const paths = findIntroducingPaths(nodeId);
  pathsEl.innerHTML = "<h4>Introducing path(s)</h4>" + paths.map((p) => `<div class="path">${p.join(" &rarr; ")}</div>`).join("");

  const highlightedEdgeIds = new Set();
  for (const p of paths) {
    for (let i = 0; i < p.length - 1; i++) {
      const idx = graphData.edges.findIndex((e) => e.from === p[i] && e.to === p[i + 1]);
      if (idx >= 0) highlightedEdgeIds.add(idx);
    }
  }
  edgesDataSet.update(
    graphData.edges.map((e, i) => ({
      id: i,
      color: highlightedEdgeIds.has(i) ? "#e74c3c" : "#ccc",
      width: highlightedEdgeIds.has(i) ? 3 : 1,
    })),
  );

  sidebar.style.display = "block";
}

async function loadGraph() {
  const sourcePath = document.getElementById("jsonPath").value;
  const response = await fetch(sourcePath);
  const data = await response.json();
  renderGraph(data);
}

document.getElementById("loadBtn").addEventListener("click", loadGraph);
loadGraph().catch(() => {
  // No default graph.json present yet; wait for the user to load one.
});
