const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.savedProperty.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.user.deleteMany({});

  // Seed Users
  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@luxury.com',
      password: 'adminpassword123', // stored plain for local simplicity/zero-dependencies
      role: 'ADMIN',
      phone: '+1 (555) 019-2834',
    },
  });

  const user = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'userpassword123',
      role: 'USER',
      phone: '+1 (555) 014-9821',
    },
  });

  console.log('Seeding properties...');

  // Seed Properties
  const properties = [
    {
      name: 'The Aurelia Penthouse',
      location: 'Manhattan, NY',
      price: 12500000,
      bedrooms: 4,
      area: 5200,
      floor: 45,
      availability: 'AVAILABLE',
      type: 'Penthouse',
      images: '/images/properties/prop1.jpg,/images/properties/prop1_alt.jpg',
      floorPlan: '/images/floorplans/plan1.png',
    },
    {
      name: 'Villa Sereno',
      location: 'Malibu, CA',
      price: 18900000,
      bedrooms: 5,
      area: 8400,
      floor: 1,
      availability: 'AVAILABLE',
      type: 'Villa',
      images: '/images/properties/prop2.jpg,/images/properties/prop2_alt.jpg',
      floorPlan: '/images/floorplans/plan2.png',
    },
    {
      name: 'The Luminary Duplex',
      location: 'Miami, FL',
      price: 8200000,
      bedrooms: 3,
      area: 3800,
      floor: 22,
      availability: 'AVAILABLE',
      type: 'Duplex',
      images: '/images/properties/prop3.jpg,/images/properties/prop3_alt.jpg',
      floorPlan: '/images/floorplans/plan3.png',
    },
    {
      name: 'The Obsidian Tower',
      location: 'London, UK',
      price: 14000000,
      bedrooms: 3,
      area: 4500,
      floor: 30,
      availability: 'AVAILABLE',
      type: 'Apartment',
      images: '/images/properties/prop4.jpg,/images/properties/prop4_alt.jpg',
      floorPlan: '/images/floorplans/plan4.png',
    },
    {
      name: 'Maison d\'Or',
      location: 'Saint-Tropez, France',
      price: 22500000,
      bedrooms: 6,
      area: 9200,
      floor: 1,
      availability: 'RESERVED',
      type: 'Villa',
      images: '/images/properties/prop5.jpg,/images/properties/prop5_alt.jpg',
      floorPlan: '/images/floorplans/plan5.png',
    },
    {
      name: 'The Zen Retreat',
      location: 'Kyoto, Japan',
      price: 6800000,
      bedrooms: 2,
      area: 2900,
      floor: 2,
      availability: 'AVAILABLE',
      type: 'Villa',
      images: '/images/properties/prop6.jpg,/images/properties/prop6_alt.jpg',
      floorPlan: '/images/floorplans/plan6.png',
    },
  ];

  for (const prop of properties) {
    await prisma.property.create({
      data: prop,
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
