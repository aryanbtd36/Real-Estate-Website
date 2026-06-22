import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireFounderSuperAdmin } from '@/lib/permissions';
import { ActivityService } from '@/lib/activity';
import { ActivityAction } from '@prisma/client';

export async function GET(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const articles = await db.cmsResearchArticle.findMany({
      orderBy: { publishedDate: 'desc' }
    });
    return NextResponse.json(articles);
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve research articles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, title, slug, thumbnail, content, status, author, publishedDate } = body;

    if (!title || !slug || !content) {
      return NextResponse.json({ error: 'Title, Slug, and Content are required fields' }, { status: 400 });
    }

    let article;
    let isNew = false;

    if (id) {
      article = await db.cmsResearchArticle.update({
        where: { id },
        data: {
          title,
          slug,
          thumbnail: thumbnail || '',
          content,
          status: status || 'DRAFT',
          author: author || 'Aura Research Team',
          publishedDate: publishedDate ? new Date(publishedDate) : undefined
        }
      });
    } else {
      isNew = true;
      article = await db.cmsResearchArticle.create({
        data: {
          title,
          slug,
          thumbnail: thumbnail || '',
          content,
          status: status || 'DRAFT',
          author: author || 'Aura Research Team',
          publishedDate: publishedDate ? new Date(publishedDate) : new Date()
        }
      });
    }

    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Research Article ${isNew ? 'Created' : 'Updated'} [Title: ${title}]`,
      details: { articleId: article.id, title, slug, isNew, status }
    });

    return NextResponse.json({ success: true, article });
  } catch (err: any) {
    console.error('[ARTICLE_POST] Error:', err);
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'An article with this slug already exists.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save research article' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireFounderSuperAdmin(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing article ID' }, { status: 400 });
    }

    const deleted = await db.cmsResearchArticle.delete({
      where: { id }
    });

    await ActivityService.log({
      actorId: auth.userId,
      action: ActivityAction.SYSTEM_EVENT,
      description: `Research Article Deleted: ${deleted.title}`,
      details: { articleId: id, title: deleted.title }
    });

    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    console.error('[ARTICLE_DELETE] Error:', err);
    return NextResponse.json({ error: 'Failed to delete research article' }, { status: 500 });
  }
}
