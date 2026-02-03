// app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { messageId, rating, feedbackText } = await req.json();

    // Validation
    if (!messageId || !rating) {
      return NextResponse.json(
        { error: 'messageId and rating are required' },
        { status: 400 }
      );
    }

    if (rating !== 1 && rating !== -1) {
      return NextResponse.json(
        { error: 'rating must be 1 (thumbs up) or -1 (thumbs down)' },
        { status: 400 }
      );
    }

    console.log(`📊 Feedback received: ${rating === 1 ? '👍' : '👎'} for message ${messageId}`);

    // Check if feedback already exists for this message
    const { data: existing } = await supabaseAdmin
      .from('message_feedback')
      .select('*')
      .eq('message_id', messageId)
      .maybeSingle();

    if (existing) {
      // Update existing feedback
      const { error } = await supabaseAdmin
        .from('message_feedback')
        .update({
          rating,
          feedback_text: feedbackText || null,
        })
        .eq('id', existing.id);

      if (error) {
        console.error('❌ Error updating feedback:', error);
        throw error;
      }

      console.log('✅ Feedback updated');
    } else {
      // Create new feedback
      const { error } = await supabaseAdmin
        .from('message_feedback')
        .insert({
          message_id: messageId,
          rating,
          feedback_text: feedbackText || null,
        });

      if (error) {
        console.error('❌ Error creating feedback:', error);
        throw error;
      }

      console.log('✅ Feedback created');
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback saved successfully',
    });
  } catch (error: any) {
    console.error('❌ Feedback API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}