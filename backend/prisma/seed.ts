import { PrismaClient, Role, ProductType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Clean up existing data to ensure idempotent seed runs
  await prisma.webhookEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.entitlement.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.material.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.class.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing tables.');

  // 2. Seed Users
  const adminPassword = await bcrypt.hash('admin123', 10);
  const studentPassword = await bcrypt.hash('student123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password: adminPassword,
      name: 'System Admin',
      role: Role.ADMIN,
    },
  });

  const student = await prisma.user.create({
    data: {
      email: 'student@test.com',
      password: studentPassword,
      name: 'Test Student',
      role: Role.STUDENT,
    },
  });

  console.log(`👤 Created Users: ${admin.email} (ADMIN), ${student.email} (STUDENT)`);

  // 3. Seed Catalogue: 1 Board > 2 Classes > 3 Subjects > 5 Chapters (1st free)
  const board = await prisma.board.create({
    data: {
      name: 'CBSE',
    },
  });
  console.log(`📚 Created Board: ${board.name}`);

  const classNames = ['Class 9', 'Class 10'];
  const subjectNames = ['Mathematics', 'Science', 'Social Science'];

  for (const className of classNames) {
    const classRecord = await prisma.class.create({
      data: {
        name: className,
        boardId: board.id,
      },
    });

    console.log(`  🏫 Created Class: ${classRecord.name}`);

    // Create Class Passes (Monthly & Annual)
    await prisma.product.create({
      data: {
        title: `${classRecord.name} Monthly Pass (30 Days)`,
        type: ProductType.MONTHLY_PASS,
        targetId: classRecord.id,
        pricePaise: 49900, // ₹499 (18% GST inclusive)
        active: true,
      },
    });

    await prisma.product.create({
      data: {
        title: `${classRecord.name} Annual Pass (365 Days)`,
        type: ProductType.ANNUAL_PASS,
        targetId: classRecord.id,
        pricePaise: 299900, // ₹2999 (18% GST inclusive)
        active: true,
      },
    });

    for (const subjectName of subjectNames) {
      const subjectRecord = await prisma.subject.create({
        data: {
          name: subjectName,
          classId: classRecord.id,
        },
      });

      console.log(`    📖 Created Subject: ${subjectRecord.name}`);

      // Create Subject Pack Product (Lifetime access to all chapters in subject)
      await prisma.product.create({
        data: {
          title: `${classRecord.name} - ${subjectRecord.name} Subject Pack`,
          type: ProductType.SUBJECT_PACK,
          targetId: subjectRecord.id,
          pricePaise: 19900, // ₹199 (18% GST inclusive)
          active: true,
        },
      });

      // 5 Chapters per subject (Chapter 1 is free, Chapters 2-5 are paid)
      for (let ch = 1; ch <= 5; ch++) {
        const isFree = ch === 1;
        const chapterRecord = await prisma.chapter.create({
          data: {
            name: `${subjectRecord.name} - Chapter ${ch}`,
            order: ch,
            isFree: isFree,
            subjectId: subjectRecord.id,
          },
        });

        // Add sample PDF material
        await prisma.material.create({
          data: {
            title: `${chapterRecord.name} - Comprehensive Notes (PDF)`,
            filePath: `/materials/${className.toLowerCase().replace(' ', '')}-${subjectName.toLowerCase()}-ch${ch}.pdf`,
            chapterId: chapterRecord.id,
          },
        });

        // If paid, create a CHAPTER product
        if (!isFree) {
          await prisma.product.create({
            data: {
              title: `${chapterRecord.name} Chapter Access`,
              type: ProductType.CHAPTER,
              targetId: chapterRecord.id,
              pricePaise: 4900, // ₹49 (18% GST inclusive)
              active: true,
            },
          });
        }
      }
    }
  }

  // 4. Seed a sample discount coupon
  await prisma.coupon.create({
    data: {
      code: 'WELCOME10',
      discountPercent: 10,
      active: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days valid
    },
  });

  console.log('🏷️ Created Sample Coupon: WELCOME10');
  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
