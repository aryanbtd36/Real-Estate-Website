/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const connStr = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
      name: 'The Hazratganj Penthouse',
      location: 'Hazratganj, Lucknow',
      price: 12500000,
      bedrooms: 4,
      area: 5200,
      areaUnit: 'Sq Ft',
      floor: 45,
      availability: 'AVAILABLE',
      type: 'Penthouse',
      images: '/images/properties/prop1.jpg,/images/properties/prop1_alt.jpg',
      floorPlan: '/images/floorplans/plan1.png',
      latitude: 26.8467,
      longitude: 80.9462,
    },
    {
      name: 'Gomti Nagar Villa',
      location: 'Gomti Nagar, Lucknow',
      price: 18900000,
      bedrooms: 5,
      area: 8400,
      areaUnit: 'Sq Ft',
      floor: 1,
      availability: 'AVAILABLE',
      type: 'Villa',
      images: '/images/properties/prop2.jpg,/images/properties/prop2_alt.jpg',
      floorPlan: '/images/floorplans/plan2.png',
      latitude: 26.8600,
      longitude: 80.9700,
    },
    {
      name: 'Indira Nagar Duplex',
      location: 'Indira Nagar, Lucknow',
      price: 8200000,
      bedrooms: 3,
      area: 3800,
      areaUnit: 'Sq Ft',
      floor: 22,
      availability: 'AVAILABLE',
      type: 'Duplex',
      images: '/images/properties/prop3.jpg,/images/properties/prop3_alt.jpg',
      floorPlan: '/images/floorplans/plan3.png',
      latitude: 26.8800,
      longitude: 80.9900,
    },
    {
      name: 'Aliganj Heights',
      location: 'Aliganj, Lucknow',
      price: 14000000,
      bedrooms: 3,
      area: 4500,
      areaUnit: 'Sq Ft',
      floor: 30,
      availability: 'AVAILABLE',
      type: 'Apartment',
      images: '/images/properties/prop4.jpg,/images/properties/prop4_alt.jpg',
      floorPlan: '/images/floorplans/plan4.png',
      latitude: 26.8900,
      longitude: 80.9400,
    },
    {
      name: 'Mahanagar Mansion',
      location: 'Mahanagar, Lucknow',
      price: 22500000,
      bedrooms: 6,
      area: 9200,
      areaUnit: 'Sq Ft',
      floor: 1,
      availability: 'RESERVED',
      type: 'Villa',
      images: '/images/properties/prop5.jpg,/images/properties/prop5_alt.jpg',
      floorPlan: '/images/floorplans/plan5.png',
      latitude: 26.8700,
      longitude: 80.9500,
    },
    {
      name: 'Jankipuram Retreat',
      location: 'Jankipuram, Lucknow',
      price: 6800000,
      bedrooms: 2,
      area: 2900,
      areaUnit: 'Sq Ft',
      floor: 2,
      availability: 'AVAILABLE',
      type: 'Villa',
      images: '/images/properties/prop6.jpg,/images/properties/prop6_alt.jpg',
      floorPlan: '/images/floorplans/plan6.png',
      latitude: 26.9200,
      longitude: 80.9400,
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
