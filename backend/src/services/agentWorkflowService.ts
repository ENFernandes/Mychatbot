import { Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";

export type WorkflowMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type WorkflowInput = { 
  messages: WorkflowMessage[];
  apiKey: string;
  workflowId: string;
  instructions?: string;  // Optional - can override workflow instructions
};

export type WorkflowResult = {
  output_text: string;
};

// Main workflow entrypoint
export const runWorkflow = async (workflow: WorkflowInput): Promise<WorkflowResult> => {
  // Set the API key for the OpenAI client
  process.env.OPENAI_API_KEY = workflow.apiKey;
  
  // Create agent with dynamic configuration
  // Do NOT specify model - let the workflow_id use the model configured in Agent Builder
  const agentConfig: any = {
    name: "DynamicAgent",
    modelSettings: {
      store: true
    }
  };

  // Only add instructions if provided (can override workflow instructions)
  if (workflow.instructions) {
    agentConfig.instructions = workflow.instructions;
  }

  const agent = new Agent(agentConfig);

  return await withTrace("AgentPrompt", async () => {
    // Convert full message history to AgentInputItem[]
    const conversationHistory: AgentInputItem[] = workflow.messages.map((msg) => {
      if (msg.role === 'assistant') {
        return {
          role: 'assistant' as const,
          status: 'completed' as const,
          content: [{ type: "output_text", text: msg.content }]
        };
      } else {
        return {
          role: 'user' as const,
          content: [{ type: "input_text", text: msg.content }]
        };
      }
    });

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: workflow.workflowId
      }
    });

    const resultTemp = await runner.run(
      agent,
      conversationHistory
    );

    if (!resultTemp.finalOutput) {
      throw new Error("Agent result is undefined");
    }

    const result: WorkflowResult = {
      output_text: resultTemp.finalOutput ?? ""
    };

    return result;
  });
};
