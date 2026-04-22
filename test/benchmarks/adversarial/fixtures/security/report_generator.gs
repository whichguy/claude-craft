/**
 * Generates a PDF report using an HTML template.
 * The report includes data provided by the user via a web form.
 */
function generateReport(formData) {
  const template = HtmlService.createTemplateFromFile('ReportTemplate');
  
  // formData.title and formData.summary are strings from a user form.
  template.reportTitle = formData.title;
  template.reportSummary = formData.summary;
  
  // CROSS-DOMAIN BUG: The template 'ReportTemplate.html' might use <?!= ?> 
  // which is 'force print' (unsafe) instead of <?= ?> (safe escaped print).
  // The logic in .gs is 'correct' (passing strings), but the boundary to HTML 
  // is where the vulnerability (XSS) occurs if the template is misconfigured.
  const htmlOutput = template.evaluate().getContent();
  
  const blob = Utilities.newBlob(htmlOutput, 'text/html', 'report.html');
  // ... code to convert blob to PDF and send via email
}

// Mocking the template content for context in this file:
/*
  <!-- ReportTemplate.html -->
  <h1><?!= reportTitle ?></h1>
  <div>
    <p><?!= reportSummary ?></p>
  </div>
*/
