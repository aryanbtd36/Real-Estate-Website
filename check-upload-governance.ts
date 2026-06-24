import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

const BYPASS_HEADER = 'aura-estates-test-bypass-secret-123';
const API_URL = 'http://127.0.0.1:3000/api/admin/cloudinary';

// Helper to send mock file
async function testUpload({
  filename,
  content,
  mimeType,
  uploadType,
  currentImagesCount = 0,
  currentFloorPlansCount = 0,
  currentBrochuresCount = 0,
  currentTotalSize = 0,
}: {
  filename: string;
  content: Buffer | string;
  mimeType: string;
  uploadType: string;
  currentImagesCount?: number;
  currentFloorPlansCount?: number;
  currentBrochuresCount?: number;
  currentTotalSize?: number;
}) {
  const formData = new FormData();
  
  // Create file blob
  const buffer = typeof content === 'string' ? Buffer.from(content) : content;
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  
  formData.append('file', blob, filename);
  formData.append('uploadType', uploadType);
  formData.append('currentImagesCount', currentImagesCount.toString());
  formData.append('currentFloorPlansCount', currentFloorPlansCount.toString());
  formData.append('currentBrochuresCount', currentBrochuresCount.toString());
  formData.append('currentTotalSize', currentTotalSize.toString());

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-bypass-auth-test': BYPASS_HEADER,
    },
    body: formData,
  });

  return {
    status: res.status,
    data: await res.json(),
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('   AURA ESTATES - MEDIA UPLOAD GOVERNANCE AUDIT TEST SUITE      ');
  console.log('================================================================\n');
  
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.log(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Rejection of oversized brochure (Limit is 5MB)
  try {
    // 6MB buffer
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    // Write PDF magic bytes so it passes magic bytes validation
    largeBuffer.write('%PDF-1.4');
    
    const result = await testUpload({
      filename: 'large_brochure.pdf',
      content: largeBuffer,
      mimeType: 'application/pdf',
      uploadType: 'brochure',
    });
    
    assert(
      result.status === 400 && result.data.error.includes('exceeds the maximum limit'),
      `Oversized brochure rejection: status=${result.status}, error="${result.data.error}"`
    );
  } catch (e: any) {
    console.error('Error running oversized brochure test:', e);
    failed++;
  }

  // 2. Rejection of invalid extension/MIME type for brochure (e.g. JPG brochure)
  try {
    const result = await testUpload({
      filename: 'brochure.jpg',
      content: 'dummy content',
      mimeType: 'image/jpeg',
      uploadType: 'brochure',
    });
    
    assert(
      result.status === 400 && result.data.error.includes('not allowed'),
      `Invalid extension for brochure: status=${result.status}, error="${result.data.error}"`
    );
  } catch (e: any) {
    console.error(e);
    failed++;
  }

  // 3. Rejection of double extensions (double_ext.jpg.webp)
  try {
    const result = await testUpload({
      filename: 'hacker.jpg.webp',
      content: 'dummy',
      mimeType: 'image/webp',
      uploadType: 'image',
    });
    
    assert(
      result.status === 400 && result.data.error.includes('Invalid or malicious file'),
      `Double extension rejection: status=${result.status}, error="${result.data.error}"`
    );
  } catch (e: any) {
    console.error(e);
    failed++;
  }

  // 4. Rejection of path traversal (../../etc/passwd)
  try {
    const result = await testUpload({
      filename: '../../etc/passwd',
      content: 'dummy',
      mimeType: 'image/webp',
      uploadType: 'image',
    });
    
    assert(
      result.status === 400 && result.data.error.includes('Invalid or malicious file'),
      `Path traversal rejection: status=${result.status}, error="${result.data.error}"`
    );
  } catch (e: any) {
    console.error(e);
    failed++;
  }

  // 5. Rejection of mismatched magic bytes (JPG extension with text contents)
  try {
    const result = await testUpload({
      filename: 'fake_jpg.jpg',
      content: 'this is not a jpeg file',
      mimeType: 'image/jpeg',
      uploadType: 'image',
    });
    
    assert(
      result.status === 400 && result.data.error.includes('Invalid or malicious file'),
      `Mismatched magic bytes rejection: status=${result.status}, error="${result.data.error}"`
    );
  } catch (e: any) {
    console.error(e);
    failed++;
  }

  // 6. Enforcing total property payload limits (40MB cumulative budget exceeded)
  try {
    const smallPdf = Buffer.from('%PDF-1.4 mock content');
    const result = await testUpload({
      filename: 'brochure.pdf',
      content: smallPdf,
      mimeType: 'application/pdf',
      uploadType: 'brochure',
      currentTotalSize: 40 * 1024 * 1024 + 1, // already exceeded
    });
    
    assert(
      result.status === 400 && result.data.error.includes('media budget of 40MB exceeded'),
      `Payload budget overflow check: status=${result.status}, error="${result.data.error}"`
    );
  } catch (e: any) {
    console.error(e);
    failed++;
  }

  // 7. Enforcing count limits (Images > 15)
  try {
    const jpgBuffer = Buffer.alloc(100);
    jpgBuffer.writeUInt32BE(0xFFD8FFE0, 0); // JPG magic bytes
    
    const result = await testUpload({
      filename: 'image.jpg',
      content: jpgBuffer,
      mimeType: 'image/jpeg',
      uploadType: 'image',
      currentImagesCount: 15,
    });
    
    assert(
      result.status === 400 && result.data.error.includes('Maximum 15 images allowed'),
      `Image count limit enforcement: status=${result.status}, error="${result.data.error}"`
    );
  } catch (e: any) {
    console.error(e);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`Tests finished: ${passed} passed, ${failed} failed.`);
  console.log('================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
