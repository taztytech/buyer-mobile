# Facebook Campaign Integration Setup

This guide explains how to use the Facebook Marketing SDK to load campaigns in the Tazty app.

## ✅ What's Already Integrated

1. ✅ **Facebook Marketing SDK AAR Files** - Copied to `android/app/libs/`
   - `facebook-marketing.aar`
   - `facebook-core.aar`
   - `facebook-common.aar`

2. ✅ **Gradle Configuration** - Added dependencies in `android/app/build.gradle`

3. ✅ **Facebook Campaign Service** - Created `src/services/facebookCampaign.service.ts`

4. ✅ **Android Manifest** - Added Facebook App ID meta-data configuration

5. ✅ **ProGuard Rules** - Added rules to prevent obfuscation of Facebook SDK classes

---

## ✅ Facebook Credentials Configured

Your Facebook integration credentials have been set up:

- **App ID**: `1793377224702906`
- **Client Token**: `2b2c11d8c7a01864118bcd2a17b28103`
- **Display Name**: `Tazty Food Delivery`

These credentials are configured in:
- `android/app/src/main/res/values/strings.xml`
- `app.config.js` (extra section)

## 📋 Configuration Steps

### 1. ✅ Facebook App Credentials - COMPLETED

Your Facebook App credentials are already configured.

### 2. ✅ Android Configuration - COMPLETED

The following files have been updated:
- `android/app/src/main/res/values/strings.xml` - Contains Facebook App ID and Client Token
- `android/app/src/main/AndroidManifest.xml` - References Facebook credentials

#### b. Get Facebook Access Token

You need a Facebook access token with the following permissions:
- `ads_read` - To read ad campaigns
- `ads_management` - To manage ad campaigns (if needed)

You can get an access token from:
- [Facebook Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- Your backend server (recommended for production)

### 3. Get Ad Account ID

Your Facebook Ad Account ID format is: `act_123456789`

You can find it in:
- Facebook Ads Manager → Account Settings
- Or use the Graph API: `GET /me/adaccounts`

---

## 🚀 Usage

### Initialize the Service

```typescript
import { facebookCampaignService } from './src/services/facebookCampaign.service';

// Initialize with your access token and ad account ID
facebookCampaignService.initialize(
  'YOUR_ACCESS_TOKEN',
  'act_123456789' // Your ad account ID
);
```

### Load Campaigns

```typescript
// Load all campaigns with default fields
const campaigns = await facebookCampaignService.loadCampaigns();

console.log('Campaigns:', campaigns.data);

// Load campaigns with custom fields
const customCampaigns = await facebookCampaignService.loadCampaigns(
  ['id', 'name', 'status', 'daily_budget'],
  50 // limit
);

// Load a specific campaign
const campaign = await facebookCampaignService.loadCampaignById('campaign_id_123');

// Load campaigns with pagination
const firstPage = await facebookCampaignService.loadCampaignsPaginated();
const nextPage = await facebookCampaignService.loadCampaignsPaginated(
  ['id', 'name'],
  25,
  firstPage.paging?.cursors?.after
);
```

### Example: React Component

```typescript
import React, { useEffect, useState } from 'react';
import { facebookCampaignService, FacebookCampaign } from './src/services/facebookCampaign.service';

const CampaignList: React.FC = () => {
  const [campaigns, setCampaigns] = useState<FacebookCampaign[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      
      // Initialize service (you should get these from secure storage or backend)
      facebookCampaignService.initialize(
        'YOUR_ACCESS_TOKEN',
        'act_123456789'
      );

      const response = await facebookCampaignService.loadCampaigns();
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Text>Loading campaigns...</Text>;
  }

  return (
    <View>
      {campaigns.map((campaign) => (
        <View key={campaign.id}>
          <Text>{campaign.name}</Text>
          <Text>Status: {campaign.status}</Text>
        </View>
      ))}
    </View>
  );
};
```

---

## 🔒 Security Best Practices

1. **Never hardcode access tokens** in your app
2. **Store tokens securely** using secure storage (e.g., `expo-secure-store`)
3. **Use backend proxy** for production apps to keep tokens server-side
4. **Rotate tokens regularly** and implement token refresh logic
5. **Use environment-specific tokens** (development vs production)

### Recommended: Backend Proxy Approach

Instead of calling Facebook API directly from the app:

```typescript
// Call your backend API instead
const response = await fetch('https://your-api.com/api/facebook/campaigns', {
  headers: {
    'Authorization': `Bearer ${userToken}`,
  },
});
```

Your backend should:
- Store Facebook access tokens securely
- Handle token refresh
- Proxy requests to Facebook API
- Add rate limiting and caching

---

## 📝 API Reference

### `facebookCampaignService.initialize(accessToken: string, adAccountId: string)`

Initialize the service with Facebook credentials.

### `facebookCampaignService.loadCampaigns(fields?: string[], limit?: number)`

Load campaigns from Facebook.

**Parameters:**
- `fields` - Array of field names to retrieve (default: `['id', 'name', 'objective', 'status', 'daily_budget', 'lifetime_budget', 'created_time', 'updated_time']`)
- `limit` - Number of campaigns to retrieve (default: `25`)

**Returns:** `Promise<FacebookCampaignResponse>`

### `facebookCampaignService.loadCampaignById(campaignId: string, fields?: string[])`

Load a specific campaign by ID.

### `facebookCampaignService.loadCampaignsPaginated(fields?: string[], limit?: number, after?: string)`

Load campaigns with pagination support.

**Parameters:**
- `after` - Cursor from previous response for pagination

### `facebookCampaignService.isInitialized()`

Check if the service is initialized.

### `facebookCampaignService.reset()`

Clear stored credentials.

---

## 🐛 Troubleshooting

### Error: "Facebook Campaign Service not initialized"

Make sure you call `initialize()` before loading campaigns.

### Error: "Invalid access token"

- Verify your access token is valid
- Check token expiration
- Ensure token has required permissions (`ads_read`)

### Error: "Invalid ad account ID"

- Verify the ad account ID format: `act_123456789`
- Ensure the access token has access to this ad account

### Build Error: "Could not find facebook-marketing.aar"

Make sure the AAR files are in `android/app/libs/` directory.

---

## 📚 Additional Resources

- [Facebook Marketing API Documentation](https://developers.facebook.com/docs/marketing-apis)
- [Facebook Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Facebook Access Tokens Guide](https://developers.facebook.com/docs/facebook-login/guides/access-tokens)
