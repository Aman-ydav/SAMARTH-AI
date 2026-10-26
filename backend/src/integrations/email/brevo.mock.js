/**
 * Test double for @getbrevo/brevo (TEST-22): no network. Use with
 *
 *   vi.mock("@getbrevo/brevo", async () => (await import("#integrations/email/brevo.mock.js")).buildMockedBrevoModule());
 */
export const brevoFake = {
    clients: [],
    sent: [],
    error: null,
    response: { messageId: "<fake-message-id@example.test>" },
    reset() {
        this.clients = [];
        this.sent = [];
        this.error = null;
        this.response = { messageId: "<fake-message-id@example.test>" };
    },
};

class FakeBrevoClient {
    constructor(options) {
        this.options = options;
        brevoFake.clients.push(options);
        this.transactionalEmails = {
            sendTransacEmail: async (request, requestOptions) => {
                brevoFake.sent.push({ request, requestOptions });
                if (brevoFake.error) throw brevoFake.error;
                return brevoFake.response;
            },
        };
    }
}

export const buildMockedBrevoModule = () => ({ BrevoClient: FakeBrevoClient });
