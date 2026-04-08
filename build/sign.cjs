const { execSync } = require('child_process')

exports.default = async function sign(configuration) {
  const filePath = configuration.path

  if (!process.env.AZURE_CLIENT_ID) {
    console.log('Skipping signing: AZURE_CLIENT_ID not set')
    return
  }

  execSync(
    `AzureSignTool sign ` +
      `-kvu "${process.env.AZURE_ENDPOINT}" ` +
      `-kva "${process.env.AZURE_CLIENT_ID}" ` +
      `-kvs "${process.env.AZURE_CLIENT_SECRET}" ` +
      `-kvt "${process.env.AZURE_TENANT_ID}" ` +
      `-kvc "${process.env.AZURE_CERT_PROFILE}" ` +
      `-kvcsa "${process.env.AZURE_CODE_SIGNING_ACCOUNT}" ` +
      `-tr "http://timestamp.acs.microsoft.com" ` +
      `-td sha256 ` +
      `"${filePath}"`,
    { stdio: 'inherit' }
  )
}
