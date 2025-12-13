/**
 * FloatingHelpButton - Entry point for Sofia support chat
 * 
 * A floating help button that appears on learning screens,
 * allowing students to quickly access support without leaving their lesson.
 * 
 * Checks for existing active tickets before creating new ones to avoid duplicates.
 */

import { useState } from "react";
import { HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupportAssistModal } from "./SupportAssistModal";
import { apiRequest } from "@/lib/queryClient";

interface FloatingHelpButtonProps {
  className?: string;
  defaultCategory?: 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
}

export function FloatingHelpButton({ 
  className = "",
  defaultCategory = 'technical',
}: FloatingHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpenSupport = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // First check for existing active ticket
      const existingResponse = await apiRequest('GET', '/api/support/tickets?status=active');
      if (existingResponse.ok) {
        const existingTickets = await existingResponse.json();
        if (Array.isArray(existingTickets) && existingTickets.length > 0) {
          // Reuse existing active ticket
          setTicketId(existingTickets[0].id);
          setIsOpen(true);
          setIsLoading(false);
          return;
        }
      }
      
      // No active ticket found, create a new one
      const response = await apiRequest('POST', '/api/support/tickets', {
        category: defaultCategory,
        subject: 'Help request from learning session',
        description: 'User clicked help button during learning',
        handoffFrom: 'direct',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create support ticket');
      }
      
      const data = await response.json();
      setTicketId(data.id || null);
      setIsOpen(true);
    } catch (err) {
      console.error('[FloatingHelp] Failed to open support:', err);
      setError('Unable to open support. Please try again.');
      // Still open the modal, it can handle the error state
      setTicketId(null);
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    // Keep ticketId to allow quick reopen without new ticket creation
  };

  const handleResolved = () => {
    setIsOpen(false);
    setTicketId(null); // Clear ticket on resolution so new ticket is created next time
    setError(null);
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40 bg-background hover-elevate ${className}`}
        onClick={handleOpenSupport}
        disabled={isLoading}
        data-testid="button-floating-help"
      >
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <HelpCircle className="h-6 w-6" />
        )}
      </Button>

      <SupportAssistModal
        isOpen={isOpen}
        onClose={handleClose}
        onResolved={handleResolved}
        ticketId={ticketId}
        category={defaultCategory}
        reason="Help request"
        priority="normal"
        mode="support"
      />
    </>
  );
}

export default FloatingHelpButton;
