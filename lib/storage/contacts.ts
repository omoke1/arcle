/**
 * Contact Management System
 * 
 * Stores and manages user contacts (address book) in encrypted localStorage
 * Allows users to send to "Jake" instead of "0x742d35Cc..."
 */

export interface Contact {
  id: string;
  name: string;
  address: string;
  nickname?: string;
  notes?: string;
  createdAt: number;
  lastUsed?: number;
}

const CONTACTS_STORAGE_KEY = "arcle_contacts";
const RECENT_ADDRESSES_KEY = "arcle_recent_addresses";

/**
 * Get all saved contacts
 */
export function getContacts(): Contact[] {
  try {
    if (typeof window === "undefined") return [];
    
    const stored = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!stored) return [];
    
    const contacts = JSON.parse(stored);
    return Array.isArray(contacts) ? contacts : [];
  } catch (error) {
    console.error("[Contacts] Error loading contacts:", error);
    return [];
  }
}

/**
 * Save a new contact
 */
export function saveContact(name: string, address: string, nickname?: string, notes?: string): Contact {
  const contacts = getContacts();
  
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
  
  // Save to localStorage
  if (typeof window !== "undefined") {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  }
  
  return contacts[existingIndex] || contacts[contacts.length - 1];
}

/**
 * Get a contact by name or nickname
 */
export function getContact(nameOrNickname: string): Contact | null {
  const contacts = getContacts();
  const searchTerm = nameOrNickname.toLowerCase().trim();
  
  return contacts.find(
    c => c.name.toLowerCase() === searchTerm || 
         c.nickname?.toLowerCase() === searchTerm
  ) || null;
}

/**
 * Get a contact by address
 */
export function getContactByAddress(address: string): Contact | null {
  const contacts = getContacts();
  return contacts.find(
    c => c.address.toLowerCase() === address.toLowerCase()
  ) || null;
}

/**
 * Delete a contact
 */
export function deleteContact(nameOrAddress: string): boolean {
  const contacts = getContacts();
  const searchTerm = nameOrAddress.toLowerCase().trim();
  
  const filteredContacts = contacts.filter(
    c => c.name.toLowerCase() !== searchTerm && 
         c.address.toLowerCase() !== searchTerm &&
         c.nickname?.toLowerCase() !== searchTerm
  );
  
  if (filteredContacts.length === contacts.length) {
    return false; // Nothing deleted
  }
  
  if (typeof window !== "undefined") {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(filteredContacts));
  }
  
  return true;
}

/**
 * Update contact last used timestamp
 */
export function updateContactLastUsed(address: string): void {
  const contacts = getContacts();
  const contact = contacts.find(c => c.address.toLowerCase() === address.toLowerCase());
  
  if (contact) {
    contact.lastUsed = Date.now();
    if (typeof window !== "undefined") {
      localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
    }
  }
}

/**
 * Get recently used addresses (not in contacts)
 */
export function getRecentAddresses(): string[] {
  try {
    if (typeof window === "undefined") return [];
    
    const stored = localStorage.getItem(RECENT_ADDRESSES_KEY);
    if (!stored) return [];
    
    const addresses = JSON.parse(stored);
    return Array.isArray(addresses) ? addresses : [];
  } catch (error) {
    console.error("[Contacts] Error loading recent addresses:", error);
    return [];
  }
}

/**
 * Add an address to recent addresses
 */
export function addRecentAddress(address: string): void {
  // Don't add if it's already a contact
  if (getContactByAddress(address)) return;
  
  let recent = getRecentAddresses();
  
  // Remove if already exists (to move to front)
  recent = recent.filter(a => a.toLowerCase() !== address.toLowerCase());
  
  // Add to front
  recent.unshift(address);
  
  // Keep only last 10
  recent = recent.slice(0, 10);
  
  if (typeof window !== "undefined") {
    localStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(recent));
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



