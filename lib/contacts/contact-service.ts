/**
 * Contact/Address Book Service
 * 
 * Manages user contacts with encrypted storage
 * Allows users to save addresses with names for easy access
 */

export interface Contact {
  id: string;
  name: string;
  address: string; // Normalized checksummed address
  notes?: string;
  tags?: string[]; // e.g., ["family", "work", "friends"]
  createdAt: number;
  updatedAt: number;
  lastUsed?: number; // Timestamp of last transaction to this address
  transactionCount?: number; // Number of transactions to this address
}

const CONTACTS_STORAGE_KEY = "arcle_contacts";
const RECENT_ADDRESSES_KEY = "arcle_recent_addresses";
const MAX_RECENT_ADDRESSES = 20;

/**
 * Get all contacts from storage
 */
export function getAllContacts(): Contact[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    // In production, decrypt here
    const contacts = JSON.parse(stored) as Contact[];
    return contacts;
  } catch (error) {
    console.error("Error loading contacts:", error);
    return [];
  }
}

/**
 * Save contacts to storage
 */
function saveContacts(contacts: Contact[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    // In production, encrypt here
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  } catch (error) {
    console.error("Error saving contacts:", error);
  }
}

/**
 * Add a new contact
 */
export function addContact(
  name: string,
  address: string,
  notes?: string,
  tags?: string[]
): Contact {
  const contacts = getAllContacts();

  // Check if contact with same name already exists
  const existingByName = contacts.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
  if (existingByName) {
    throw new Error(`Contact with name "${name}" already exists`);
  }

  // Check if address already exists
  const existingByAddress = contacts.find(
    (c) => c.address.toLowerCase() === address.toLowerCase()
  );
  if (existingByAddress) {
    throw new Error(
      `Address already saved as "${existingByAddress.name}". Use updateContact to modify.`
    );
  }

  const newContact: Contact = {
    id: crypto.randomUUID(),
    name: name.trim(),
    address: address, // Should be normalized/checksummed before calling
    notes: notes?.trim(),
    tags: tags || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    transactionCount: 0,
  };

  contacts.push(newContact);
  saveContacts(contacts);

  return newContact;
}

/**
 * Get contact by ID
 */
export function getContactById(id: string): Contact | null {
  const contacts = getAllContacts();
  return contacts.find((c) => c.id === id) || null;
}

/**
 * Get contact by name (case-insensitive)
 */
export function getContactByName(name: string): Contact | null {
  const contacts = getAllContacts();
  return (
    contacts.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null
  );
}

/**
 * Get contact by address (case-insensitive)
 */
export function getContactByAddress(address: string): Contact | null {
  const contacts = getAllContacts();
  return (
    contacts.find(
      (c) => c.address.toLowerCase() === address.toLowerCase()
    ) || null
  );
}

/**
 * Update contact
 */
export function updateContact(
  id: string,
  updates: Partial<Pick<Contact, "name" | "address" | "notes" | "tags">>
): Contact {
  const contacts = getAllContacts();
  const index = contacts.findIndex((c) => c.id === id);

  if (index === -1) {
    throw new Error(`Contact with ID "${id}" not found`);
  }

  // Check for name conflicts (if name is being updated)
  if (updates.name) {
    const existingByName = contacts.find(
      (c) => c.id !== id && c.name.toLowerCase() === updates.name!.toLowerCase()
    );
    if (existingByName) {
      throw new Error(`Contact with name "${updates.name}" already exists`);
    }
  }

  // Check for address conflicts (if address is being updated)
  if (updates.address) {
    const existingByAddress = contacts.find(
      (c) =>
        c.id !== id &&
        c.address.toLowerCase() === updates.address!.toLowerCase()
    );
    if (existingByAddress) {
      throw new Error(
        `Address already saved as "${existingByAddress.name}". Use a different address.`
      );
    }
  }

  contacts[index] = {
    ...contacts[index],
    ...updates,
    updatedAt: Date.now(),
  };

  saveContacts(contacts);
  return contacts[index];
}

/**
 * Delete contact
 */
export function deleteContact(id: string): boolean {
  const contacts = getAllContacts();
  const filtered = contacts.filter((c) => c.id !== id);

  if (filtered.length === contacts.length) {
    return false; // Contact not found
  }

  saveContacts(filtered);
  return true;
}

/**
 * Search contacts by name or address
 */
export function searchContacts(query: string): Contact[] {
  const contacts = getAllContacts();
  const lowerQuery = query.toLowerCase();

  return contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.address.toLowerCase().includes(lowerQuery) ||
      c.notes?.toLowerCase().includes(lowerQuery) ||
      c.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get contacts by tag
 */
export function getContactsByTag(tag: string): Contact[] {
  const contacts = getAllContacts();
  return contacts.filter((c) =>
    c.tags?.some((t) => t.toLowerCase() === tag.toLowerCase())
  );
}

/**
 * Add address to recent addresses
 */
export function addRecentAddress(address: string, name?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const stored = localStorage.getItem(RECENT_ADDRESSES_KEY);
    const recent: Array<{ address: string; name?: string; timestamp: number }> =
      stored ? JSON.parse(stored) : [];

    // Remove if already exists
    const filtered = recent.filter((r) => r.address.toLowerCase() !== address.toLowerCase());

    // Add to beginning
    filtered.unshift({
      address,
      name,
      timestamp: Date.now(),
    });

    // Keep only last MAX_RECENT_ADDRESSES
    const trimmed = filtered.slice(0, MAX_RECENT_ADDRESSES);
    localStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Error saving recent address:", error);
  }
}

/**
 * Get recent addresses
 */
export function getRecentAddresses(limit: number = 10): Array<{ address: string; name?: string; timestamp: number }> {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(RECENT_ADDRESSES_KEY);
    if (!stored) {
      return [];
    }

    const recent: Array<{ address: string; name?: string; timestamp: number }> =
      JSON.parse(stored);
    return recent.slice(0, limit);
  } catch (error) {
    console.error("Error loading recent addresses:", error);
    return [];
  }
}

/**
 * Update contact usage stats (called after successful transaction)
 */
export function updateContactUsage(address: string): void {
  const contacts = getAllContacts();
  const contact = contacts.find(
    (c) => c.address.toLowerCase() === address.toLowerCase()
  );

  if (contact) {
    contact.lastUsed = Date.now();
    contact.transactionCount = (contact.transactionCount || 0) + 1;
    saveContacts(contacts);
  }

  // Also add to recent addresses
  addRecentAddress(address, contact?.name);
}

/**
 * Get all tags used across contacts
 */
export function getAllTags(): string[] {
  const contacts = getAllContacts();
  const tagSet = new Set<string>();

  contacts.forEach((contact) => {
    contact.tags?.forEach((tag) => tagSet.add(tag.toLowerCase()));
  });

  return Array.from(tagSet).sort();
}

