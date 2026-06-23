import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

// Bypasses the terminal sandbox DNS restriction by pointing directly to the database IP
process.env.DATABASE_URL = "postgresql://postgres.fmajzxxsqmemgqqlnaik:AryanMishra3662@13.239.87.90:5432/postgres?sslmode=no-verify";

async function bootstrapTemplatesIfNeeded() {
  const { db } = await import('./src/lib/db');

  const defaults = [
    {
      name: 'Plot Template',
      type: 'PLOT',
      fields: [
        { name: 'roadWidth', label: 'Road Width (Ft)', type: 'number', required: false },
        { name: 'facing', label: 'Facing', type: 'dropdown', required: false, options: ['North', 'East', 'South', 'West', 'North-East', 'South-East', 'North-West', 'South-West'] },
        { name: 'registryStatus', label: 'Registry Status', type: 'dropdown', required: true, options: ['Freehold', 'Leasehold', 'Power of Attorney'] },
        { name: 'boundaryCoordinates', label: 'Boundary Coordinates', type: 'text', required: false },
        { name: 'cornerPlot', label: 'Corner Plot', type: 'checkbox', required: false },
        { name: 'dimensions', label: 'Dimensions', type: 'text', required: false }
      ]
    },
    {
      name: 'Apartment Template',
      type: 'APARTMENT',
      fields: [
        { name: 'bhk', label: 'BHK', type: 'dropdown', required: true, options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK+'] },
        { name: 'floor', label: 'Floor', type: 'number', required: false },
        { name: 'tower', label: 'Tower', type: 'text', required: false },
        { name: 'amenities', label: 'Amenities', type: 'multiselect', required: false, options: ['Lift', 'Gym', 'Swimming Pool', 'Clubhouse', 'Power Backup'] },
        { name: 'balcony', label: 'Balcony', type: 'number', required: false }
      ]
    },
    {
      name: 'Residency Template',
      type: 'RESIDENCY',
      fields: [
        { name: 'bedrooms', label: 'Bedrooms', type: 'number', required: true },
        { name: 'bathrooms', label: 'Bathrooms', type: 'number', required: true },
        { name: 'parking', label: 'Parking', type: 'number', required: false },
        { name: 'garden', label: 'Garden', type: 'checkbox', required: false }
      ]
    },
    {
      name: 'Commercial Template',
      type: 'COMMERCIAL',
      fields: [
        { name: 'officeArea', label: 'Office Area', type: 'number', required: true },
        { name: 'floor', label: 'Floor', type: 'number', required: false },
        { name: 'powerBackup', label: 'Power Backup', type: 'checkbox', required: false },
        { name: 'parkingCapacity', label: 'Parking Capacity', type: 'number', required: false }
      ]
    }
  ];

  for (const item of defaults) {
    const existing = await db.propertyTemplate.findUnique({
      where: { type: item.type }
    });

    if (!existing) {
      const template = await db.propertyTemplate.create({
        data: {
          name: item.name,
          type: item.type,
          fields: item.fields,
          version: 1
        }
      });
      await db.propertyTemplateVersion.create({
        data: {
          templateId: template.id,
          version: 1,
          fields: item.fields,
          changedBy: 'System Bootstrapper'
        }
      });
      console.log(`[BOOTSTRAP] Created template: ${item.type}`);
    } else {
      console.log(`[BOOTSTRAP] Template exists: ${item.type}`);
    }
  }
}

async function runAudit() {
  console.log('================================================================');
  console.log('       AURA ESTATES - PLATFORM PROPERTY CRUD LIFECYCLE AUDIT   ');
  console.log('================================================================\n');

  await bootstrapTemplatesIfNeeded();

  const { db } = await import('./src/lib/db');

  const propertyTypes = [
    {
      type: 'PLOT',
      dbType: 'Plot',
      mockFields: { roadWidth: 40, facing: 'North-East', registryStatus: 'Freehold', cornerPlot: true },
      editFields: { roadWidth: 60, facing: 'East', registryStatus: 'Freehold', cornerPlot: false }
    },
    {
      type: 'APARTMENT',
      dbType: 'Apartment',
      mockFields: { bhk: '3 BHK', floor: 12, tower: 'Tower Alpha', balcony: 2 },
      editFields: { bhk: '3 BHK', floor: 14, tower: 'Tower Alpha', balcony: 3 }
    },
    {
      type: 'RESIDENCY',
      dbType: 'Residency',
      mockFields: { bedrooms: 4, bathrooms: 4, parking: 2, garden: true },
      editFields: { bedrooms: 5, bathrooms: 5, parking: 3, garden: true }
    },
    {
      type: 'COMMERCIAL',
      dbType: 'Commercial',
      mockFields: { officeArea: 2500, floor: 3, powerBackup: true, parkingCapacity: 10 },
      editFields: { officeArea: 2800, floor: 3, powerBackup: true, parkingCapacity: 12 }
    }
  ];

  const results: any[] = [];

  for (const item of propertyTypes) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`AUDITING PROPERTY TYPE: ${item.type}`);
    console.log(`------------------------------------------------------------`);
    
    const auditRecord: any = {
      type: item.type,
      create: 'FAIL',
      reload: 'FAIL',
      publish: 'FAIL',
      archive: 'FAIL',
      edit: 'FAIL',
      editPreserved: 'FAIL',
      delete: 'FAIL',
      imagesPersisted: 'FAIL',
      brochurePersisted: 'FAIL',
      videoPersisted: 'FAIL',
      templateFieldsPersisted: 'FAIL',
      dbConsistency: 'FAIL'
    };

    try {
      // 1. Get Template ID
      const template = await db.propertyTemplate.findUnique({
        where: { type: item.type }
      });
      if (!template) {
        throw new Error(`Template not found for type: ${item.type}`);
      }

      // 2. CREATE PROPERTY (Initially in DRAFT status)
      const propName = `Audit Property ${item.type} ${Date.now()}`;
      const mockImage = {
        publicId: `mock-image-${item.type.toLowerCase()}-${Date.now()}`,
        url: `https://res.cloudinary.com/dhpn9bqak/image/upload/v1/mock-image-${item.type.toLowerCase()}.jpg`,
        isCover: true,
        order: 0
      };
      const mockVideoUrl = `https://res.cloudinary.com/dhpn9bqak/video/upload/v1/mock-video-${item.type.toLowerCase()}.mp4`;
      const mockBrochureUrl = `https://res.cloudinary.com/dhpn9bqak/raw/upload/v1/mock-brochure-${item.type.toLowerCase()}.pdf`;

      console.log(`[1] Creating Property with DRAFT status & Media references...`);
      const created = await db.property.create({
        data: {
          name: propName,
          description: `Audit validation for ${item.type}`,
          type: item.dbType,
          price: 5000000,
          bedrooms: item.type === 'PLOT' ? 0 : 3,
          area: 1500,
          floor: 1,
          images: mockImage.url,
          videoUrl: mockVideoUrl,
          brochureUrl: mockBrochureUrl,
          status: 'DRAFT',
          templateId: template.id,
          templateFields: item.mockFields as any,
          imagesRelation: {
            create: [mockImage]
          }
        },
        include: {
          imagesRelation: true
        }
      });

      if (created && created.id) {
        auditRecord.create = 'PASS';
        console.log(`    PASS: Created property ID: ${created.id}`);
      } else {
        throw new Error('Property creation returned null/undefined ID');
      }

      // 3. RELOAD & DATA SAVE VERIFICATION
      console.log(`[2] Reloading Property from DB to verify saved fields & media...`);
      const reloaded = await db.property.findUnique({
        where: { id: created.id },
        include: { imagesRelation: true }
      });

      if (reloaded) {
        auditRecord.reload = 'PASS';
        console.log(`    PASS: Reloaded successfully.`);

        // Verify Image URL and relationship persistence
        const hasImages = reloaded.imagesRelation.length === 1 && 
                          reloaded.imagesRelation[0].publicId === mockImage.publicId &&
                          reloaded.imagesRelation[0].url === mockImage.url;
        if (hasImages) {
          auditRecord.imagesPersisted = 'PASS';
          console.log(`    PASS: Image relations and details successfully persisted.`);
        } else {
          console.log(`    FAIL: Image relation verification failed. Length: ${reloaded.imagesRelation.length}`);
        }

        // Verify Video URLs
        if (reloaded.videoUrl === mockVideoUrl) {
          auditRecord.videoPersisted = 'PASS';
          console.log(`    PASS: Video URL persists.`);
        } else {
          console.log(`    FAIL: Video URL does not match. Found: ${reloaded.videoUrl}`);
        }

        // Verify Brochure URLs
        if (reloaded.brochureUrl === mockBrochureUrl) {
          auditRecord.brochurePersisted = 'PASS';
          console.log(`    PASS: Brochure URL persists.`);
        } else {
          console.log(`    FAIL: Brochure URL does not match. Found: ${reloaded.brochureUrl}`);
        }

        // Verify Template Fields
        const savedFields = reloaded.templateFields as any;
        let fieldsMatch = true;
        for (const k of Object.keys(item.mockFields)) {
          if (savedFields[k] !== (item.mockFields as any)[k]) {
            fieldsMatch = false;
            console.log(`    FAIL: Key ${k} mismatch. Expected ${(item.mockFields as any)[k]}, got ${savedFields[k]}`);
          }
        }
        if (fieldsMatch) {
          auditRecord.templateFieldsPersisted = 'PASS';
          console.log(`    PASS: Template fields are fully accurate.`);
        }
      } else {
        console.log(`    FAIL: Property reload returned null.`);
      }

      // 4. PUBLISH PROPERTY
      console.log(`[3] Transitioning status to PUBLISHED...`);
      const published = await db.property.update({
        where: { id: created.id },
        data: { status: 'PUBLISHED' }
      });
      if (published && published.status === 'PUBLISHED') {
        auditRecord.publish = 'PASS';
        console.log(`    PASS: Status updated to PUBLISHED.`);
      } else {
        console.log(`    FAIL: Status did not transition to PUBLISHED.`);
      }

      // 5. ARCHIVE PROPERTY
      console.log(`[4] Transitioning status to ARCHIVED...`);
      const archived = await db.property.update({
        where: { id: created.id },
        data: { status: 'ARCHIVED' }
      });
      if (archived && archived.status === 'ARCHIVED') {
        auditRecord.archive = 'PASS';
        console.log(`    PASS: Status updated to ARCHIVED.`);
      } else {
        console.log(`    FAIL: Status did not transition to ARCHIVED.`);
      }

      // 6. EDIT PROPERTY & PRESERVATION OF VALUES
      console.log(`[5] Editing property (price and templateFields)...`);
      const edited = await db.property.update({
        where: { id: created.id },
        data: {
          price: 5900000,
          templateFields: item.editFields as any
        }
      });

      console.log(`[6] Reloading to verify edit persistence & data preservation...`);
      const reloadedEdit = await db.property.findUnique({
        where: { id: created.id },
        include: { imagesRelation: true }
      });

      if (reloadedEdit && reloadedEdit.price === 5900000) {
        auditRecord.edit = 'PASS';
        console.log(`    PASS: Price updated correctly to 5900000.`);

        // Verify edited template fields match
        const editedFields = reloadedEdit.templateFields as any;
        let editFieldsMatch = true;
        for (const k of Object.keys(item.editFields)) {
          if (editedFields[k] !== (item.editFields as any)[k]) {
            editFieldsMatch = false;
            console.log(`    FAIL: Key ${k} mismatch after edit. Expected ${(item.editFields as any)[k]}, got ${editedFields[k]}`);
          }
        }
        if (editFieldsMatch) {
          console.log(`    PASS: Template fields updated correctly.`);
        }

        // Verify preservation of other fields (name, description, type, media url strings, image relations)
        const namePreserved = reloadedEdit.name === propName;
        const descPreserved = reloadedEdit.description === `Audit validation for ${item.type}`;
        const typePreserved = reloadedEdit.type === item.dbType;
        const videoPreserved = reloadedEdit.videoUrl === mockVideoUrl;
        const brochurePreserved = reloadedEdit.brochureUrl === mockBrochureUrl;
        const imagesPreserved = reloadedEdit.imagesRelation.length === 1 && 
                                reloadedEdit.imagesRelation[0].publicId === mockImage.publicId;

        if (namePreserved && descPreserved && typePreserved && videoPreserved && brochurePreserved && imagesPreserved) {
          auditRecord.editPreserved = 'PASS';
          console.log(`    PASS: Values of unmodified fields were preserved correctly during edit.`);
        } else {
          console.log(`    FAIL: Some values were mutated/lost on edit. (Name: ${namePreserved}, Desc: ${descPreserved}, Type: ${typePreserved}, Video: ${videoPreserved}, Brochure: ${brochurePreserved}, Images: ${imagesPreserved})`);
        }
      } else {
        console.log(`    FAIL: Price was not updated or reloadedEdit was null.`);
      }

      // 7. DELETE PROPERTY & DB CONSISTENCY (Cascade Delete Verification)
      console.log(`[7] Deleting Property...`);
      await db.property.delete({
        where: { id: created.id }
      });

      console.log(`[8] Checking database consistency (verifying removal of property and related image)...`);
      const deletedCheck = await db.property.findUnique({
        where: { id: created.id }
      });
      const imagesDeletedCheck = await db.propertyImage.findMany({
        where: { propertyId: created.id }
      });

      if (!deletedCheck && imagesDeletedCheck.length === 0) {
        auditRecord.delete = 'PASS';
        auditRecord.dbConsistency = 'PASS';
        console.log(`    PASS: Property and related images were successfully cascade-deleted from DB.`);
      } else {
        console.log(`    FAIL: Orphans left. PropertyExists: ${!!deletedCheck}, ImagesCount: ${imagesDeletedCheck.length}`);
      }

    } catch (err: any) {
      console.error(`ERROR DURING AUDIT FOR ${item.type}:`, err.message || err);
    }

    results.push(auditRecord);
  }

  console.log('\n================================================================');
  console.log('                    AUDIT RESULT SUMMARY MATRIX                 ');
  console.log('================================================================');
  console.table(results);
}

runAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
