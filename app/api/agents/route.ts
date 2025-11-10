/**
 * AI Agents API Route
 * 
 * GET /api/agents - List all agents
 * POST /api/agents - Create new agent
 * GET /api/agents/:id - Get agent by ID
 * PUT /api/agents/:id - Update agent
 * DELETE /api/agents/:id - Delete agent
 * GET /api/agents/marketplace - Get marketplace agents
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createAIAgent,
  getAllAIAgents,
  getAgentById,
  updateAgent,
  getAllAgentExecutions,
  getExecutionsForAgent,
  executeAgentAction,
  getMarketplaceAgents,
} from "@/lib/agents/ai-agent-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const executions = searchParams.get("executions");
    const marketplace = searchParams.get("marketplace") === "true";
    
    // Get marketplace agents
    if (marketplace) {
      const agents = getMarketplaceAgents();
      return NextResponse.json({ success: true, data: agents });
    }
    
    // Get single agent
    if (id) {
      const agent = getAgentById(id);
      if (!agent) {
        return NextResponse.json(
          { success: false, error: "Agent not found" },
          { status: 404 }
        );
      }
      
      // Include executions if requested
      if (executions === "true") {
        const agentExecutions = getExecutionsForAgent(id);
        return NextResponse.json({
          success: true,
          data: { ...agent, executions: agentExecutions },
        });
      }
      
      return NextResponse.json({ success: true, data: agent });
    }
    
    // Get all agents
    const agents = getAllAIAgents();
    return NextResponse.json({ success: true, data: agents });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch agents",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;
    
    // Execute agent action
    if (action === "execute") {
      const { agentId, action: actionType, details, transactionHash } = params;
      
      if (!agentId || !actionType) {
        return NextResponse.json(
          { success: false, error: "agentId and action are required" },
          { status: 400 }
        );
      }
      
      try {
        const execution = executeAgentAction(agentId, actionType, details, transactionHash);
        return NextResponse.json({ success: true, data: execution });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to execute action",
          },
          { status: 400 }
        );
      }
    }
    
    // Create agent
    const { name, description, permissions, metadata } = params;
    
    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, error: "name and permissions array are required" },
        { status: 400 }
      );
    }
    
    const agent = createAIAgent({
      name,
      description,
      permissions,
      metadata,
    });
    
    return NextResponse.json({ success: true, data: agent });
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create agent",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id parameter is required" },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const agent = updateAgent(id, body);
    
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: agent });
  } catch (error) {
    console.error("Error updating agent:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update agent",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id parameter is required" },
        { status: 400 }
      );
    }
    
    const agent = updateAgent(id, { status: "cancelled" });
    if (!agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: "Agent cancelled" });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete agent",
      },
      { status: 500 }
    );
  }
}

