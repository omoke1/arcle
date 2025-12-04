/**
 * Contact Management System
 * 
 * Stores and manages user contacts (address book) in Supabase
 * Allows users to send to "Jake" instead of "0x742d35Cc..."
 */

import { loadPreference, savePreference } from "@/lib/supabase-data";

export interface Contact {
  id: string;
  name: string;
  address: string;
  nickname?: string;
  notes?: string;
  createdAt: number;
  lastUsed?: number;
}

const CONTACTS_STORAGE_KEY = "contacts";
const RECENT_ADDRESSES_KEY = "recent_addresses";

/**
 * Get all saved contacts
 */
export async function getContacts(userId: string): Promise<Contact[]> {
  try {
    if (typeof window === "undefined") return [];
    
    // Try Supabase first
    try {
      const pref = await loadPreference({ userId, key: CONTACTS_STORAGE_KEY });
      if (pref?.value && Array.isArray(pref.value)) {
        return pref.value;
      }
    } catch (error) {
      console.warn("[Contacts] Failed to load from Supabase, trying localStorage migration:", error);
    }
    
    // Migration fallback: try localStorage
    const stored = localStorage.getItem("arcle_contacts");
    if (stored) {
      const contacts = JSON.parse(stored);
      if (Array.isArray(contacts)) {
        // Migrate to Supabase
        try {
          await savePreference({ userId, key: CONTACTS_STORAGE_KEY, value: contacts });
          localStorage.removeItem("arcle_contacts");
        } catch (error) {
          console.error("[Contacts] Failed to migrate contacts to Supabase:", error);
        }
        return contacts;
      }
    }
    
    return [];
  } catch (error) {
    console.error("[Contacts] Error loading contacts:", error);
    return [];
  }
}

/**
 * Save a new contact
 */
export async function saveContact(userId: string, name: string, address: string, nickname?: string, notes?: string): Promise<Contact> {
  const contacts = await getContacts(userId);
  
  // Check if contact already exists
  const existingIndex = contacts.findIndex(
    c => c.address.toLowerCase() === address.toLowerCase() || c.name.toLowerCase() === name.toLowerCase()
  );
  
  if (existingIndex !== -1) {
    // Update existing contact
    contacts[existingIndex] = {
      ...contacts[existingIndex],
      name,
      address,
      nickname,
      notes,
      lastUsed: Date.now(),
    };
  } else {
    // Add new contact
    const newContact: Contact = {
      id: crypto.randomUUID(),
      name,
      address,
      nickname,
      notes,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };
    contacts.push(newContact);
  }
  
  // Save to Supabase
  try {
    await savePreference({ userId, key: CONTACTS_STORAGE_KEY, value: contacts });
  } catch (error) {
    console.error("[Contacts] Failed to save to Supabase:", error);
    // Migration fallback
    if (typeof window !== "undefined") {
      localStorage.setItem("arcle_contacts", JSON.stringify(contacts));
    }
  }
  
  return contacts[existingIndex] || contacts[contacts.length - 1];
}

/**
 * Get a contact by name or nickname
 */
export async function getContact(userId: string, nameOrNickname: string): Promise<Contact | null> {
  const contacts = await getContacts(userId);
  const searchTerm = nameOrNickname.toLowerCase().trim();
  
  return contacts.find(
    c => c.name.toLowerCase() === searchTerm || 
         c.nickname?.toLowerCase() === searchTerm
  ) || null;
}

/**
 * Get a contact by address
 */
export async function getContactByAddress(userId: string, address: string): Promise<Contact | null> {
  const contacts = await getContacts(userId);
  return contacts.find(
    c => c.address.toLowerCase() === address.toLowerCase()
  ) || null;
}

/**
 * Delete a contact
 */
export async function deleteContact(userId: string, nameOrAddress: string): Promise<boolean> {
  const contacts = await getContacts(userId);
  const searchTerm = nameOrAddress.toLowerCase().trim();
  
  const filteredContacts = contacts.filter(
    c => c.name.toLowerCase() !== searchTerm && 
         c.address.toLowerCase() !== searchTerm &&
         c.nickname?.toLowerCase() !== searchTerm
  );
  
  if (filteredContacts.length === contacts.length) {
    return false; // Nothing deleted
  }
  
  // Save to Supabase
  try {
    await savePreference({ userId, key: CONTACTS_STORAGE_KEY, value: filteredContacts });
  } catch (error) {
    console.error("[Contacts] Failed to save to Supabase:", error);
    // Migration fallback
    if (typeof window !== "undefined") {
      localStorage.setItem("arcle_contacts", JSON.stringify(filteredContacts));
    }
  }
  
  return true;
}

/**
 * Update contact last used timestamp
 */
export async function updateContactLastUsed(userId: string, address: string): Promise<void> {
  const contacts = await getContacts(userId);
  const contact = contacts.find(c => c.address.toLowerCase() === address.toLowerCase());
  
  if (contact) {
    contact.lastUsed = Date.now();
    try {
      await savePreference({ userId, key: CONTACTS_STORAGE_KEY, value: contacts });
    } catch (error) {
      console.error("[Contacts] Failed to save to Supabase:", error);
      // Migration fallback
      if (typeof window !== "undefined") {
        localStorage.setItem("arcle_contacts", JSON.stringify(contacts));
      }
    }
  }
}

/**
 * Get recently used addresses (not in contacts)
 */
export async function getRecentAddresses(userId: string): Promise<string[]> {
  try {
    if (typeof window === "undefined") return [];
    
    // Try Supabase first
    try {
      const pref = await loadPreference({ userId, key: RECENT_ADDRESSES_KEY });
      if (pref?.value && Array.isArray(pref.value)) {
        return pref.value;
      }
    } catch (error) {
      console.warn("[Contacts] Failed to load recent addresses from Supabase, trying localStorage migration:", error);
    }
    
    // Migration fallback: try localStorage
    const stored = localStorage.getItem("arcle_recent_addresses");
    if (stored) {
      const addresses = JSON.parse(stored);
      if (Array.isArray(addresses)) {
        // Migrate to Supabase
        try {
          await savePreference({ userId, key: RECENT_ADDRESSES_KEY, value: addresses });
          localStorage.removeItem("arcle_recent_addresses");
        } catch (error) {
          console.error("[Contacts] Failed to migrate recent addresses to Supabase:", error);
        }
        return addresses;
      }
    }
    
    return [];
  } catch (error) {
    console.error("[Contacts] Error loading recent addresses:", error);
    return [];
  }
}

/**
 * Add an address to recent addresses
 */
export async function addRecentAddress(userId: string, address: string): Promise<void> {
  // Don't add if it's already a contact
  const existingContact = await getContactByAddress(userId, address);
  if (existingContact) return;
  
  let recent = await getRecentAddresses(userId);
  
  // Remove if already exists (to move to front)
  recent = recent.filter(a => a.toLowerCase() !== address.toLowerCase());
  
  // Add to front
  recent.unshift(address);
  
  // Keep only last 10
  recent = recent.slice(0, 10);
  
  // Save to Supabase
  try {
    await savePreference({ userId, key: RECENT_ADDRESSES_KEY, value: recent });
  } catch (error) {
    console.error("[Contacts] Failed to save to Supabase:", error);
    // Migration fallback
    if (typeof window !== "undefined") {
      localStorage.setItem("arcle_recent_addresses", JSON.stringify(recent));
    }
  }
}

/**
 * Format contact for display
 */
export function formatContactForDisplay(contact: Contact): string {
  const addr = contact.address;
  const shortAddr = `${addr.substring(0, 6)}...${addr.substring(38)}`;
  
  if (contact.nickname) {
    return `${contact.name} (${contact.nickname}) - ${shortAddr}`;
  }
  
  return `${contact.name} - ${shortAddr}`;
}

/**
 * Format all contacts for AI response
 */
export function formatContactsForAI(contacts: Contact[]): string {
  if (contacts.length === 0) {
    return "You don't have any saved contacts yet. Want to save someone?";
  }
  
  const contactLines = contacts.map((c, i) => {
    const addr = `${c.address.substring(0, 6)}...${c.address.substring(38)}`;
    return `  ${i + 1}. ${c.name}${c.nickname ? ` (${c.nickname})` : ""} - ${addr}`;
  });
  
  return `Here are your contacts:\n\n${contactLines.join("\n")}\n\nWant to send to someone?`;
}

/**
 * Get all contacts (async wrapper for backward compatibility)
 */
export async function getAllContacts(userId: string): Promise<Contact[]> {
  return getContacts(userId);
}



