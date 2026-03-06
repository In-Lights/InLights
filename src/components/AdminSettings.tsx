import { useState } from 'react';
import { AdminSettings as AdminSettingsType } from '../types';
import { saveAdminSettings, sendTestDiscord } from '../store';
import { Settings, Bell, Shield, Database, Save, CheckCircle, AlertCircle, Send } from 'lucide-react';

interface Props {
  settings: AdminSettingsType;
  onSettingsChange: (s: AdminSettingsType) => void;
}

export default function AdminSettingsPanel({ settings, onSettingsChange }: Props) {
  const [localSettings, setLocalSettings] = useState<AdminSettingsType>(settings);
  const [activeTab, setActiveTab] = useState<'general' | 'form' | 'security' | 'notifications' | 'sheets'>('general');
  const [saved, setSaved] = useState(false);
  const [discordTestResult, setDiscordTestResult] = useState<'success' | 'fail' | null>(null);
  const [testing, setTesting] = useState(false);

  const updateField = (field: keyof AdminSettingsType, value: string) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveAdminSettings(localSettings);
    onSettingsChange(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestDiscord = async () => {
    if (!localSettings.discordWebhookUrl) return;
    setTesting(true);
    setDiscordTestResult(null);
    const ok = await sendTestDiscord(localSettings.discordWebhookUrl);
    setDiscordTestResult(ok ? 'success' : 'fail');
    setTesting(false);
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'form' as const, label: 'Form', icon: Database },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'sheets' as const, label: 'Google Sheets', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-purple-400" /> Settings
        </h2>
        <button onClick={handleSave} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors">
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {saved && (
        <div className="bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" /> Settings saved successfully!
        </div>
      )}

      <div className="flex gap-2 border-b border-zinc-700 pb-2 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'bg-zinc-800 text-purple-400 border-b-2 border-purple-400' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">General Settings</h3>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-blue-300 text-sm">
              <p className="font-medium mb-1">🌐 Public Branding</p>
              <p>When Google Sheets is connected, logo and company name changes are visible to ALL visitors globally. Without Google Sheets, changes only apply to this browser.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Company Name</label>
              <input type="text" value={localSettings.companyName} onChange={e => updateField('companyName', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Company Logo URL</label>
              <input type="url" value={localSettings.companyLogo} onChange={e => updateField('companyLogo', e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none" />
              {localSettings.companyLogo && (
                <div className="mt-3 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-700 flex items-center justify-center">
                    <img src={localSettings.companyLogo} alt="Logo preview" className="w-full h-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <span className="text-zinc-400 text-sm">Logo Preview</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'form' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Form Settings</h3>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Welcome Title</label>
              <input type="text" value={localSettings.welcomeText} onChange={e => updateField('welcomeText', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Welcome Description</label>
              <textarea value={localSettings.welcomeDescription} onChange={e => updateField('welcomeDescription', e.target.value)} rows={3}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none resize-none" />
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Security Settings</h3>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-300 text-sm">
              ⚠️ Change your default credentials immediately after first login!
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Admin Username</label>
              <input type="text" value={localSettings.adminUsername} onChange={e => updateField('adminUsername', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Admin Password</label>
              <input type="password" value={localSettings.adminPassword} onChange={e => updateField('adminPassword', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none" />
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Discord Notifications</h3>
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 text-indigo-300 text-sm space-y-2">
              <p className="font-medium">📋 How to set up Discord Webhook:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open your Discord server</li>
                <li>Go to <strong>Server Settings → Integrations → Webhooks</strong></li>
                <li>Click <strong>"New Webhook"</strong></li>
                <li>Choose the channel for notifications</li>
                <li>Click <strong>"Copy Webhook URL"</strong></li>
                <li>Paste it below and click <strong>Save Settings</strong></li>
              </ol>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Discord Webhook URL</label>
              <input type="url" value={localSettings.discordWebhookUrl} onChange={e => updateField('discordWebhookUrl', e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none" />
            </div>
            {localSettings.discordWebhookUrl && (
              <div className="flex items-center gap-3">
                <button onClick={handleTestDiscord} disabled={testing}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
                  <Send className="w-4 h-4" /> {testing ? 'Sending...' : 'Send Test Message'}
                </button>
                {discordTestResult === 'success' && (
                  <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Test sent! Check Discord</span>
                )}
                {discordTestResult === 'fail' && (
                  <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Failed. Check URL</span>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sheets' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Google Sheets Database</h3>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-300 text-sm space-y-3">
              <p className="font-medium text-base">📊 Google Sheets = Your Global Database</p>
              <p>All releases, settings, and branding are stored in Google Sheets so everything is synced across all devices and visible to all visitors.</p>
              
              <p className="font-medium mt-4">Step 1: Create a Google Sheet</p>
              <p>Create a new Google Sheet. Name it "In Lights Releases".</p>
              
              <p className="font-medium mt-4">Step 2: Add the Apps Script</p>
              <p>Go to <strong>Extensions → Apps Script</strong>, delete any code, and paste this:</p>
              <div className="bg-zinc-900 rounded-lg p-3 mt-2 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre">{`function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = e.parameter.action;
  
  if (action === 'getSettings') {
    var sheet = ss.getSheetByName('Settings');
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({})).setMimeType(ContentService.MimeType.JSON);
    var data = sheet.getRange('A2:D2').getValues()[0];
    return ContentService.createTextOutput(JSON.stringify({
      companyName: data[0] || 'In Lights',
      companyLogo: data[1] || '',
      welcomeText: data[2] || 'Submit Your Release',
      welcomeDescription: data[3] || ''
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getReleases') {
    var sheet = ss.getSheetByName('Releases');
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({releases:[]})).setMimeType(ContentService.MimeType.JSON);
    var rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return ContentService.createTextOutput(JSON.stringify({releases:[]})).setMimeType(ContentService.MimeType.JSON);
    var releases = [];
    for (var i = 1; i < rows.length; i++) {
      try { releases.push(JSON.parse(rows[i][1])); } catch(e) {}
    }
    return ContentService.createTextOutput(JSON.stringify({releases: releases})).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = JSON.parse(e.postData.contents);
  
  if (data.action === 'saveSettings') {
    var sheet = ss.getSheetByName('Settings');
    if (!sheet) {
      sheet = ss.insertSheet('Settings');
      sheet.getRange('A1:D1').setValues([['Company Name','Logo URL','Welcome Text','Welcome Description']]);
    }
    sheet.getRange('A2:D2').setValues([[data.companyName, data.companyLogo, data.welcomeText, data.welcomeDescription]]);
    return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (data.action === 'saveRelease') {
    var sheet = ss.getSheetByName('Releases');
    if (!sheet) {
      sheet = ss.insertSheet('Releases');
      sheet.getRange('A1:N1').setValues([['ID','JSON Data','Status','Submitted At','Artist','Title','Type','Genre','Release Date','Explicit','Tracks','Cover Art','Drive Folder','Label Notes']]);
    }
    var r = data.release;
    var trackNames = r.tracks.map(function(t){return t.title}).join(', ');
    sheet.appendRow([r.id, JSON.stringify(r), r.status, r.submittedAt, r.mainArtist, r.releaseTitle, r.releaseType, r.genre, r.releaseDate, r.explicit?'Yes':'No', trackNames, r.coverArtDriveLink, r.driveFolderLink, r.labelNotes||'']);
    return ContentService.createTextOutput(JSON.stringify({status:'ok',id:r.id})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (data.action === 'updateRelease') {
    var sheet = ss.getSheetByName('Releases');
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({status:'error'})).setMimeType(ContentService.MimeType.JSON);
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.id) {
        var existing = JSON.parse(rows[i][1]);
        var updated = Object.assign(existing, data.updates);
        var trackNames = updated.tracks.map(function(t){return t.title}).join(', ');
        sheet.getRange(i+1, 1, 1, 14).setValues([[updated.id, JSON.stringify(updated), updated.status, updated.submittedAt, updated.mainArtist, updated.releaseTitle, updated.releaseType, updated.genre, updated.releaseDate, updated.explicit?'Yes':'No', trackNames, updated.coverArtDriveLink, updated.driveFolderLink, updated.labelNotes||'']]);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
}`}</div>

              <p className="font-medium mt-4">Step 3: Deploy</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Click <strong>Deploy → New deployment</strong></li>
                <li>Type: <strong>Web app</strong></li>
                <li>Execute as: <strong>Me</strong></li>
                <li>Who has access: <strong>Anyone</strong></li>
                <li>Click <strong>Deploy</strong></li>
                <li>Copy the Web app URL and paste it below</li>
              </ol>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Google Apps Script Web App URL</label>
              <input type="url" value={localSettings.googleSheetsWebhook} onChange={e => updateField('googleSheetsWebhook', e.target.value)}
                placeholder="https://script.google.com/macros/s/...../exec"
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none" />
            </div>
            {!localSettings.googleSheetsWebhook && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-300 text-sm">
                ⚠️ Without Google Sheets, data is stored in this browser only (localStorage). Connect Google Sheets for global sync across all devices.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
