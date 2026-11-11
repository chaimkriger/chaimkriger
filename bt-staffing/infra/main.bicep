// United Care ABA - BT Staffing: Azure resources.
//   App Service (Linux container) + Azure Container Registry
//   + Azure Database for PostgreSQL flexible server.
// Deploy:  az deployment group create -g <resource-group> -f infra/main.bicep -p infra/main.parameters.json
// NOTE: written by hand and not yet deployed to a real subscription. Run
// `az deployment group what-if` first.

@description('Short lowercase name used as a prefix for every resource, e.g. "ucbt".')
@minLength(3)
@maxLength(12)
param namePrefix string

param location string = resourceGroup().location

@description('App Service plan size. B1 is the smallest tier that supports always-on.')
param appServiceSku string = 'B1'

@description('PostgreSQL admin user name.')
param postgresAdminUser string = 'btadmin'

@secure()
@description('PostgreSQL admin password. Letters and digits only keeps the connection string simple.')
param postgresAdminPassword string

@secure()
@description('Session signing secret, at least 32 characters.')
param authSecret string

@secure()
param workdayWebhookSecret string

@secure()
param salesmsgWebhookSecret string

@secure()
param cronSecret string

@allowed(['mock', 'live'])
param hubspotMode string = 'mock'

@secure()
@description('HubSpot private app token. Only used when hubspotMode is live.')
param hubspotPrivateAppToken string = ''

@description('HubSpot object that holds cases: deals, tickets, or a custom object type id.')
param hubspotCaseObject string = 'deals'

@description('Container image tag to run.')
param imageTag string = 'latest'

var suffix = uniqueString(resourceGroup().id)
var acrName = toLower('${namePrefix}acr${suffix}')
var appName = '${namePrefix}-app-${suffix}'
var pgName = '${namePrefix}-pg-${suffix}'
var dbName = 'bt_staffing'
var imageName = 'bt-staffing'
var acrPullRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: pgName
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: postgresAdminUser
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: dbName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// 0.0.0.0 - 0.0.0.0 is Azure's "allow access from Azure services" rule.
// For production, prefer VNet integration + a private endpoint.
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-plan-${suffix}'
  location: location
  kind: 'linux'
  sku: { name: appServiceSku }
  properties: { reserved: true }
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'app,linux,container'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${imageName}:${imageTag}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      healthCheckPath: '/api/health'
      appSettings: [
        { name: 'WEBSITES_PORT', value: '3000' }
        { name: 'DATABASE_URL', value: 'postgresql://${postgresAdminUser}:${postgresAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${dbName}?schema=public&sslmode=require' }
        { name: 'AUTH_SECRET', value: authSecret }
        { name: 'APP_URL', value: 'https://${appName}.azurewebsites.net' }
        { name: 'HUBSPOT_MODE', value: hubspotMode }
        { name: 'HUBSPOT_PRIVATE_APP_TOKEN', value: hubspotPrivateAppToken }
        { name: 'HUBSPOT_CASE_OBJECT', value: hubspotCaseObject }
        { name: 'APPLOI_MODE', value: 'mock' }
        { name: 'SALESMSG_MODE', value: 'mock' }
        { name: 'WORKDAY_MODE', value: 'mock' }
        { name: 'WORKDAY_WEBHOOK_SECRET', value: workdayWebhookSecret }
        { name: 'SALESMSG_WEBHOOK_SECRET', value: salesmsgWebhookSecret }
        { name: 'CRON_SECRET', value: cronSecret }
        { name: 'SEED_ON_START', value: 'false' }
        { name: 'SHOW_DEMO_LOGINS', value: 'false' }
      ]
    }
  }
  dependsOn: [database, allowAzure]
}

// Lets the web app pull its image from the registry without a password.
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, app.id, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: acrPullRoleId
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output appUrl string = 'https://${app.properties.defaultHostName}'
output appName string = app.name
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output postgresHost string = postgres.properties.fullyQualifiedDomainName
