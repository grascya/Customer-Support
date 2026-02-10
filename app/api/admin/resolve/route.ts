// app/api/admin/resolve/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Update conversation status to resolved
    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({ 
        status: 'resolved',
        metadata: { 
          resolved_at: new Date().toISOString() 
        }
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Error resolving conversation:', updateError);
      throw updateError;
    }

    // Track resolution event in analytics
    await supabaseAdmin
      .from('chat_analytics')
      .insert({
        conversation_id: conversationId,
        event_type: 'resolved',
        event_data: { resolved_by: 'admin' },
      });

    console.log(`✅ Conversation ${conversationId} marked as resolved`);

    return NextResponse.json({ 
      success: true,
      message: 'Conversation marked as resolved' 
    });

  } catch (error: any) {
    console.error('❌ Error in resolve endpoint:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}