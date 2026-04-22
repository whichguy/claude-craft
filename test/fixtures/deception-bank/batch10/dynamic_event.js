/**
 * Renders a list of events dynamically using an HTML string.
 * The event data includes a JSON stringified metadata object in a data attribute.
 */
function renderEvents(events) {
  const container = document.getElementById('event-list');
  let html = '';

  events.forEach(event => {
    // metadata is a JS object. We stringify it for storage in a data-attribute.
    const metadataStr = JSON.stringify(event.metadata);
    
    // CROSS-DOMAIN BUG: The JS logic (JSON.stringify) is correct for JS.
    // However, when placing it into an HTML attribute, double quotes in the JSON
    // will break the attribute if it's also wrapped in double quotes.
    // e.g., data-meta="{"key":"value"}" becomes data-meta="{" key="value"}"
    // This leads to malformed HTML and potential attribute injection if keys are user-controlled.
    html += `
      <div class="event-item" data-meta="${metadataStr}">
        <h4>${event.name}</h4>
        <button onclick="showDetails(this)">View Details</button>
      </div>
    `;
  });

  container.innerHTML = html;
}

function showDetails(elem) {
  const meta = JSON.parse(elem.getAttribute('data-meta'));
  console.log("Metadata:", meta);
}
