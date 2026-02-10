// lib/integrations/freshdesk.ts

import axios from 'axios';

const freshdeskClient = axios.create({
  baseURL: `https://${process.env.FRESHDESK_DOMAIN}/api/v2`,
  auth: {
    username: process.env.FRESHDESK_API_KEY!,
    password: 'X', // Freshdesk uses API key as username, password is ignored
  },
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface FreshdeskTicket {
  subject: string;
  description: string;
  email: string;
  priority: 1 | 2 | 3 | 4; // 1=Low, 2=Medium, 3=High, 4=Urgent
  status: 2 | 3 | 4 | 5; // 2=Open, 3=Pending, 4=Resolved, 5=Closed
  tags?: string[];
  custom_fields?: Record<string, any>;
}

export interface FreshdeskResponse {
  id: number;
  subject: string;
  description: string;
  status: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new support ticket in Freshdesk
 */
export async function createFreshdeskTicket(
  ticket: FreshdeskTicket
): Promise<FreshdeskResponse> {
  try {
    console.log('🎫 Creating Freshdesk ticket...');
    
    const response = await freshdeskClient.post<FreshdeskResponse>('/tickets', ticket);
    
    console.log(`✅ Freshdesk ticket created: #${response.data.id}`);
    return response.data;
    
  } catch (error: any) {
    console.error('❌ Failed to create Freshdesk ticket:', error.response?.data || error.message);
    throw new Error(`Freshdesk API error: ${error.response?.data?.description || error.message}`);
  }
}

/**
 * Get ticket details
 */
export async function getFreshdeskTicket(ticketId: number): Promise<FreshdeskResponse> {
  try {
    const response = await freshdeskClient.get<FreshdeskResponse>(`/tickets/${ticketId}`);
    return response.data;
  } catch (error: any) {
    console.error('❌ Failed to fetch Freshdesk ticket:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Update ticket status
 */
export async function updateFreshdeskTicket(
  ticketId: number,
  updates: Partial<FreshdeskTicket>
): Promise<FreshdeskResponse> {
  try {
    const response = await freshdeskClient.put<FreshdeskResponse>(`/tickets/${ticketId}`, updates);
    console.log(`✅ Freshdesk ticket #${ticketId} updated`);
    return response.data;
  } catch (error: any) {
    console.error('❌ Failed to update Freshdesk ticket:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Add note to ticket
 */
export async function addFreshdeskNote(
  ticketId: number,
  noteBody: string,
  isPrivate: boolean = false
): Promise<void> {
  try {
    await freshdeskClient.post(`/tickets/${ticketId}/notes`, {
      body: noteBody,
      private: isPrivate,
    });
    console.log(`✅ Note added to ticket #${ticketId}`);
  } catch (error: any) {
    console.error('❌ Failed to add note:', error.response?.data || error.message);
    throw error;
  }
}