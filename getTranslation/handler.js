const AWS = require('aws-sdk');
const S3 = new AWS.S3();
const Textract = new AWS.Textract();
const Translate = new AWS.Translate();
const PDFDocument = require('pdfkit');
const streamBuffers = require('stream-buffers');
const qs = require('querystring');
const axios = require('axios');

module.exports.getTranslation = async (event) => {

    const bucketName = event.Records[0].s3.bucket.name;
    const fileName = event.Records[0].s3.object.key;
    console.log("bucketName ======>>>> " + bucketName);
    console.log("fileName ======>>>> " + fileName);
    const sfId = fileName.split('-')[1];
    let sourceLanguage = fileName.split('-')[2];
    let targetLanguage = fileName.split('-')[3].split('.')[0];


    if(sourceLanguage === 'English') {
      sourceLanguage = 'en';
    } else if (sourceLanguage === 'Spanish') {
      sourceLanguage = 'es';
    } else if (sourceLanguage === 'Japanese') {
      sourceLanguage = 'ja';
    } else if (sourceLanguage === 'French') {
      sourceLanguage = 'fr';
    } else if (sourceLanguage === 'Korean') {
      sourceLanguage = 'ko';
    } else if (sourceLanguage === 'Mandarin') {
      sourceLanguage = 'zh';
    } else if (sourceLanguage === 'Arabic') {
      sourceLanguage = 'ar';
    }

    if(targetLanguage === 'English') {
      targetLanguage = 'en';
    } else if (targetLanguage === 'Spanish') {
      targetLanguage = 'es';
    } else if (targetLanguage === 'Japanese') {
      targetLanguage = 'ja';
    } else if (targetLanguage === 'French') {
      targetLanguage = 'fr';
    } else if (targetLanguage === 'Korean') {
      targetLanguage = 'ko';
    } else if (targetLanguage === 'Mandarin') {
      targetLanguage = 'zh';
    } else if (targetLanguage === 'Arabic') {
      targetLanguage = 'ar';
    }

    console.log("sfID =========>>>>> " + sfId);
    try {
      console.log("step 1");
      // Get the file from S3
      const file = await S3.getObject({
          Bucket: bucketName,
          Key: fileName
      }).promise();
      console.log("step 2")
      // Detect text using Textract
      const textractParams = {
          Document: {
              Bytes: file.Body
          }
      };
      console.log("step 3")
      const textractData = await Textract.detectDocumentText(textractParams).promise();
      console.log("Textract Response =====>>>> " + JSON.stringify(textractData));
      console.log("step 4")
      let extractedText = '';
      textractData.Blocks.forEach(block => {
          if (block.BlockType === 'LINE') {
              extractedText += block.Text + '\n';
          }
      });
      console.log("step 5")
      console.log("sourceLanguage ====>>>> " + sourceLanguage);
      console.log("targetLanguage ====>>>> " + targetLanguage);
      // Translate text using Translate
      const translateParams = {
        SourceLanguageCode: 'es', // Auto-detect the source language
        // TargetLanguageCode: 'en', // Change to the target language code you want
        TargetLanguageCode: targetLanguage,
        Text: extractedText
      };
      console.log("step 6")
      const translatedData = await Translate.translateText(translateParams).promise();
      const translatedText = translatedData.TranslatedText;
      console.log("Translate Response ======>>>>>> " + translatedText);
      console.log("TYPEOF translatedText ===========>>>>>> " + typeof(translatedText))
      console.log("step 7")
      
      // Create a new PDF with the translated text
      const pdfDoc = new PDFDocument();
      const writableStreamBuffer = new streamBuffers.WritableStreamBuffer({
          initialSize: (100 * 1024), // start at 100 kilobytes.
          incrementAmount: (10 * 1024) // grow by 10 kilobytes each time buffer overflows.
      });
      console.log("step 8")
      pdfDoc.pipe(writableStreamBuffer);
      pdfDoc.text(translatedText);
      pdfDoc.end();
      console.log("step 9")

      await new Promise(resolve => {
        pdfDoc.on('end', resolve);
      });
      console.log("PDF Created Sucessfully!");
      console.log("TYPEOF PDF ======>>>>> " + typeof(pdfDoc))

      // Convert the PDF buffer to a base64 string
      const pdfBuffer = writableStreamBuffer.getContents();
      // const pdfBase64 = pdfBuffer.toString('base64')
      
      // Upload the new PDF to S3
      const uploadParams = {
        Bucket: process.env.TRANSLATION_BUCKET_NAME,
        Key: `translated-${fileName}`,
        Body: pdfBuffer,
        ContentType: 'application/pdf'
      };
      console.log("step 10")
      
      await S3.putObject(uploadParams).promise();
      console.log("step 11");

      //send response back to SF
      console.log("MOVING ON TO SEND RESPONSE TO SF*********")
      const login_url = 'https://login.salesforce.com/services/oauth2/token';
      const client_id = process.env.CLIENT_ID;
      const client_secret = process.env.CLIENT_SECRET;
      const username = process.env.SF_USERNAME;
      const password = process.env.SF_PASSWORD;
      const security_token = process.env.SF_SECURITY_TOKEN;
      // const request_body = new URLSearchParams();
      console.log('step 12');
      // Authenticate with Salesforce
      const authResponse = await axios.post(login_url, qs.stringify({
        grant_type: 'password',
        client_id: client_id,
        client_secret: client_secret,
        username: username,
        password: password + security_token
      }));
      const accessToken = authResponse.data.access_token;
      const instanceUrl = authResponse.data.instance_url;

      console.log("accessToken =========>>>>> " + accessToken);
      console.log("instanceUrl =========>>>>> " + instanceUrl);
        
      // Upload the file to Salesforce
      const contentVersionResponse = await axios.post(`${instanceUrl}/services/data/v52.0/sobjects/ContentVersion`, {
        Title: 'translated-' + fileName,
        PathOnClient: 'translated-' + fileName + '.pdf',
        // VersionData: file.Body.toString('base64'),
        VersionData: pdfBuffer.toString('base64')
        // FirstPublishLocationId: sfId
      }, {
          headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
          }
      });

      console.log("contentVersionResponse =============>>>>>> " + contentVersionResponse);
      console.log("contentVersionResponse.data =========>>>>>> " + JSON.stringify(contentVersionResponse.data));
      
      const contentVersionId = contentVersionResponse.data.id;
      console.log("contentVersionId ========>>>>> " + contentVersionId);

      // Query to get the ContentDocumentId using the ContentVersionId
      const queryResponse = await axios.get(`${instanceUrl}/services/data/v52.0/query`, {
          params: {
              q: `SELECT ContentDocumentId FROM ContentVersion WHERE Id = '${contentVersionId}'`
          },
          headers: {
              'Authorization': `Bearer ${accessToken}`
          }
      });
      
      if (queryResponse.data.records.length === 0) {
        console.log("queryResponse.data.records[0] =========>>>> " + queryResponse.data.records[0])
        throw new Error('No records found for ContentVersionId: ' + contentVersionId)
      }
      const contentDocumentId = queryResponse.data.records[0].ContentDocumentId;
      console.log('contentDocumentId ==========>>>>>>> ' + contentDocumentId);

      // Link the file to the Case
      await axios.post(`${instanceUrl}/services/data/v52.0/sobjects/ContentDocumentLink`, {
          ContentDocumentId: contentDocumentId,
          LinkedEntityId: sfId,
          ShareType: 'V'
      }, {
          headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
          }
      });
      
      console.log('File uploaded and linked to Case successfully!');
      return {
          statusCode: 200,
          body: JSON.stringify('File uploaded and linked to Case successfully')
      };
    } catch (error) {
      console.error(error);
      return {
          statusCode: 500,
          body: JSON.stringify('Error processing file')
      };
  }
};