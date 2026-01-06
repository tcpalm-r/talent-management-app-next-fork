# Sonance 360 Reviews - Teams App Package

This folder contains the Microsoft Teams app manifest and assets needed to publish the app to your organization.

## Required Files

Before creating the app package, you need to add two icon files:

### 1. `color.png` (192x192 pixels)
- Full color icon used in Teams app catalog and tabs
- PNG format, 192x192 pixels
- Use the Sonance logo with brand colors
- Background should be transparent or the brand accent color (#00A3E1)

### 2. `outline.png` (32x32 pixels)
- Monochrome outline icon used in the Teams activity bar
- PNG format, 32x32 pixels
- Must be white (#FFFFFF) on transparent background
- Simple outline/silhouette of the logo

## Creating the App Package

Once you have all files (manifest.json, color.png, outline.png):

1. Select all three files
2. Create a ZIP archive containing these files at the root level (not in a subfolder)
3. Name it `sonance-360-reviews.zip`

```bash
cd teams-app
zip sonance-360-reviews.zip manifest.json color.png outline.png
```

## Publishing to Your Organization

### Option A: Teams Admin Center (Recommended for "Built for your org")

1. Go to [Microsoft Teams Admin Center](https://admin.teams.microsoft.com)
2. Navigate to **Teams apps** > **Manage apps**
3. Click **+ Upload new app**
4. Select your `sonance-360-reviews.zip` file
5. The app will appear under "Built for your org" for all users

### Option B: Developer Portal (For testing)

1. Go to [Teams Developer Portal](https://dev.teams.microsoft.com)
2. Click **Apps** > **Import app**
3. Upload your ZIP file
4. Click **Publish** > **Publish to your org**

## App Manifest Details

| Field | Value |
|-------|-------|
| App ID | `ed55b32f-81b9-41e5-b43b-882c2987c01c` |
| Tenant ID | `ae4bbd35-942c-4c35-b794-274bc9cdd718` |
| Content URL | `https://sonance-360-review.vercel.app/?inTeams=true` |
| Config URL | `https://sonance-360-review.vercel.app/config` |

## Tab Types

### Personal Tab (Static)
- Appears in the left rail when user adds the app
- Direct access to 360 Reviews dashboard
- Uses SSO for authentication

### Channel/Chat Tab (Configurable)
- Can be added to any channel or group chat
- Shows configuration page when adding
- Team members can access the shared tab

## Troubleshooting

### App doesn't load in Teams
- Verify CSP headers are deployed (check vercel.json)
- Ensure `validDomains` includes your domain
- Check browser console for errors

### SSO not working
- Verify Azure AD app registration is correct
- Check that Teams client IDs are authorized in Azure AD
- Ensure redirect URIs match exactly

### Theme not syncing
- The app should automatically detect Teams theme
- Check browser console for TeamsProvider logs
