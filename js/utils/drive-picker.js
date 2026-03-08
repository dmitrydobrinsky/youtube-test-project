// drive-picker.js — Google Drive Picker integration
// Requires user to supply their own Google Client ID & API Key

let pickerApiLoaded = false;
let oauthToken = null;

export function openDrivePicker(clientId, apiKey) {
  return new Promise((resolve, reject) => {
    if (!clientId) {
      reject(new Error('Google Client ID is required. Add it in Settings (Step 6).'));
      return;
    }

    function loadGapi() {
      if (window.gapi) {
        initPicker();
      } else {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = initPicker;
        script.onerror = () => reject(new Error('Failed to load Google API'));
        document.head.appendChild(script);
      }
    }

    function initPicker() {
      gapi.load('auth2:picker', () => {
        gapi.auth2.init({ client_id: clientId }).then(auth => {
          auth.signIn().then(user => {
            oauthToken = user.getAuthResponse().access_token;
            showPicker();
          }).catch(reject);
        }).catch(reject);
      });
    }

    function showPicker() {
      const view = new google.picker.View(google.picker.ViewId.DOCS);
      view.setMimeTypes('text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(oauthToken)
        .setDeveloperKey(apiKey || '')
        .setCallback(data => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            downloadDriveFile(doc.id, doc.name, doc.mimeType)
              .then(resolve)
              .catch(reject);
          } else if (data.action === google.picker.Action.CANCEL) {
            reject(new Error('cancelled'));
          }
        })
        .build();
      picker.setVisible(true);
    }

    loadGapi();
  });
}

async function downloadDriveFile(fileId, name, mimeType) {
  // If it's a Google Sheet, export as xlsx
  let url;
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
    name = name + '.xlsx';
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${oauthToken}` }
  });
  if (!resp.ok) throw new Error('Failed to download file from Drive');
  const blob = await resp.blob();
  return new File([blob], name, { type: blob.type });
}
