#!/bin/bash
mkdir -p appscript

echo "Creating Code.gs..."
cat << 'CODEGS' > appscript/Code.gs
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
      .setTitle('Streamline Digital Imaging')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Custom Orders Sheet
  let customSheet = ss.getSheetByName('Custom Orders');
  if (!customSheet) {
    customSheet = ss.insertSheet('Custom Orders');
    customSheet.appendRow(['Timestamp', 'Project Name', 'Organization', 'Contact Name', 'Email', 'Phone', 'Needed By', 'Project Type', 'Quantity', 'Fulfillment', 'Budget', 'Methods']);
    customSheet.getRange("A1:L1").setFontWeight("bold");
    customSheet.setFrozenRows(1);
  }
  
  // Sticker Orders Sheet
  let stickerSheet = ss.getSheetByName('Sticker Orders');
  if (!stickerSheet) {
    stickerSheet = ss.insertSheet('Sticker Orders');
    stickerSheet.appendRow(['Timestamp', 'Size', 'Quantity', 'Finish', 'Cut Style', 'Fulfillment', 'Needs Art Help', 'Name', 'Email', 'Phone', 'Needed By', 'Shipping Address', 'Notes']);
    stickerSheet.getRange("A1:M1").setFontWeight("bold");
    stickerSheet.setFrozenRows(1);
  }
  
  // Contact Messages Sheet
  let contactSheet = ss.getSheetByName('Contact Messages');
  if (!contactSheet) {
    contactSheet = ss.insertSheet('Contact Messages');
    contactSheet.appendRow(['Timestamp', 'Name', 'Email', 'Message']);
    contactSheet.getRange("A1:D1").setFontWeight("bold");
    contactSheet.setFrozenRows(1);
  }
  
  // Stores Data Sheet
  let storesSheet = ss.getSheetByName('Stores');
  if (!storesSheet) {
    storesSheet = ss.insertSheet('Stores');
    storesSheet.appendRow(['Group', 'Type', 'Name', 'Logo URL', 'URL']);
    storesSheet.getRange("A1:E1").setFontWeight("bold");
    storesSheet.setFrozenRows(1);
  }
}

function submitCustomOrder(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Custom Orders');
  if (!sheet) return {success: false, error: 'Sheet not found'};
  sheet.appendRow([
    new Date(),
    data.project || '',
    data.organization || '',
    data.name || '',
    data.email || '',
    data.phone || '',
    data.date || '',
    data['project-type'] || '',
    data.quantity || '',
    data.fulfillment || '',
    data.budget || '',
    data.methods ? data.methods.join(', ') : ''
  ]);
  return {success: true};
}

function submitStickerOrder(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Sticker Orders');
  if (!sheet) return {success: false, error: 'Sheet not found'};
  
  // The 'art-help' might not be in the form if unchecked, or it might be 'on'
  const needsHelp = (data['art-help'] === 'on' || data['art-help'] === true) ? 'Yes' : 'No';

  sheet.appendRow([
    new Date(),
    data.size || '',
    data.quantity || '',
    data.finish || '',
    data.cut || '',
    data['sticker-fulfillment'] || '',
    needsHelp,
    data.name || '',
    data.email || '',
    data.phone || '',
    data.date || '',
    data['shipping-address'] || '',
    data.notes || ''
  ]);
  return {success: true};
}

function submitContactMessage(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Contact Messages');
  if (!sheet) return {success: false, error: 'Sheet not found'};
  sheet.appendRow([
    new Date(),
    data.name || '',
    data.email || '',
    data.message || ''
  ]);
  return {success: true};
}
CODEGS

echo "Creating Stylesheet.html..."
echo "<style>" > appscript/Stylesheet.html
cat assets/style.css >> appscript/Stylesheet.html
echo "</style>" >> appscript/Stylesheet.html

echo "Creating JavaScript.html..."
echo "<script>" > appscript/JavaScript.html
cat assets/stores.js >> appscript/JavaScript.html
cat assets/app.js >> appscript/JavaScript.html
cat assets/admin.js >> appscript/JavaScript.html
cat << 'JS' >> appscript/JavaScript.html

// Google Apps Script Integration for form submission
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".order-form").forEach(form => {
    form.addEventListener("submit", (e) => {
      // app.js already prevents default, but we'll capture data here
      if (typeof google === 'undefined' || !google.script) return; // Only run if in GAS environment

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      if (form.dataset.panel === 'custom') {
        data.methods = formData.getAll('method');
        google.script.run.withSuccessHandler(() => console.log('Custom order saved to sheet')).submitCustomOrder(data);
      } else if (form.dataset.panel === 'stickers') {
        // Need to check the art-help checkbox manually since FormData might omit it if unchecked
        const artHelpCheckbox = form.querySelector('[data-art-help]');
        if (artHelpCheckbox) {
          data['art-help'] = artHelpCheckbox.checked;
        }
        google.script.run.withSuccessHandler(() => console.log('Sticker order saved to sheet')).submitStickerOrder(data);
      }
    });
  });

  const contactForm = document.querySelector("[data-contact-form]");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      if (typeof google === 'undefined' || !google.script) return;
      const inputs = contactForm.querySelectorAll("input, textarea");
      const data = {
        name: inputs[0].value,
        email: inputs[1].value,
        message: inputs[2].value
      };
      google.script.run.withSuccessHandler(() => console.log('Message saved to sheet')).submitContactMessage(data);
    });
  }
});
JS
echo "</script>" >> appscript/JavaScript.html

echo "Creating Index.html..."
sed -e 's/<link rel="stylesheet" href="assets\/style.css">/<?!= include('\''Stylesheet'\''); ?>/g' \
    -e '/<script src="assets\/stores.js"><\/script>/d' \
    -e '/<script src="assets\/app.js"><\/script>/d' \
    -e 's/<script src="assets\/admin.js"><\/script>/<?!= include('\''JavaScript'\''); ?>/g' \
    index.html > appscript/Index.html

echo "Done!"
