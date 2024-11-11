import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

class TerminalAesthetics {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });
    this.chatContainer = document.getElementById("chat");
    this.inputChat = document.getElementById("messageInput");
    this.messageList = document.getElementById("messageList");
    this.backDownButton = document.getElementById("backDown");
    this.newChatButton = document.getElementById("newChat");
    this.deleteChatButton = document.getElementById("delChat");
    this.currentConversationId = null;
    this.setupEventListeners();
    this.renderConversationsList();
  }

  setupEventListeners() {
    document.getElementById("conversationsList").addEventListener("change", (event) => {
      const selectedConversationId = event.target.value;
      if (selectedConversationId) this.selectConversation(selectedConversationId);
    });

    this.inputChat.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const inputText = this.inputChat.value;
        if (inputText === "deleteChat") {
          this.deleteConversation(this.currentConversationId);
          this.inputChat.value = "";
        } else {
          this.sendMessage();
          this.inputChat.value = "";
        }
      }
      this.inputChat.focus();
    });

    window.addEventListener("scroll", () => {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const contentHeight = document.documentElement.scrollHeight;
      const isScrollable = contentHeight > windowHeight;
      const isAtBottom = scrollPosition + windowHeight >= contentHeight - 100;
      this.backDownButton.style.display = (isScrollable && !isAtBottom) ? "grid" : "none";
    });


    this.chatContainer.addEventListener("click", () => this.inputChat.focus());
    this.backDownButton.addEventListener("click", () => this.scrollToBottom());
    this.newChatButton.addEventListener("click", () => this.createNewChat());
    this.deleteChatButton.addEventListener("click", () => this.deleteConversation(this.currentConversationId));

    this.inputChat.addEventListener("input", (e) => {
      this.inputChat.style.height = "auto";
      this.inputChat.style.height = `${this.inputChat.scrollHeight}px`;
      this.scrollToBottom();
    });
  }

  removeEmojis(text) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{1F004}-\u{1F0CF}\u{2B06}\u{2194}\u{21A9}\u{1F004}\u{1F0CF}]/gu;
    return text.replace(emojiRegex, "");
  }

  cleanText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  generateUniqueId() {
    return "msg-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  }

  async sendMessage() {
    if (!this.currentConversationId) this.currentConversationId = this.generateUniqueId();
    let inputText = this.inputChat.value;
    if (!inputText.trim()) return;
    inputText = this.removeEmojis(inputText);
    const message = {
      id: this.generateUniqueId(),
      timestamp: new Date().toISOString(),
      sender: "user",
      content: inputText
    };
    this.saveMessage(this.currentConversationId, message);
    this.renderMessages(this.currentConversationId);
    const contextString = this.getContextMessages(this.currentConversationId, 4);
    const fullText = contextString
      ? `${contextString}\nusuario: ${inputText}`
      : `Início de conversa\nusuario: ${inputText}`;
    const result = await this.model.generateContent(fullText);
    const aiMessage = {
      id: this.generateUniqueId(),
      timestamp: new Date().toISOString(),
      sender: "ai",
      content: this.removeEmojis(result.response.text())
    };
    this.saveMessage(this.currentConversationId, aiMessage);
    this.renderMessages(this.currentConversationId);
  }

  getContextMessages(conversationId, limit = 4) {
    const chatHistory = this.getChatHistory(conversationId);
    if (chatHistory.length === 0) return "";

    const lastMessages = chatHistory.slice(-limit);
    return lastMessages
      .map(msg => `${msg.sender === "user" ? "usuario" : "gemini"}: ${this.cleanText(msg.content)}`)
      .join("\n");
  }

  saveMessage(conversationId, message) {
    let chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    if (!chatGemini[conversationId]) chatGemini[conversationId] = [];
    chatGemini[conversationId].push(message);
    localStorage.setItem("chatGemini", JSON.stringify(chatGemini));
  }

  getChatHistory(conversationId) {
    const chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    return chatGemini[conversationId] || [];
  }

  renderMessages(conversationId) {
    const chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    this.messageList.innerHTML = "";
    if (chatGemini[conversationId]) {
      chatGemini[conversationId].forEach((msg) => {
        const messageElement = document.createElement("li");
        messageElement.classList.add(msg.sender);
        const messageContent = document.createElement("span");
        messageContent.innerHTML = msg.sender === "ai" ? marked.parse(msg.content) : msg.content;
        messageElement.appendChild(messageContent);
        this.messageList.appendChild(messageElement);
      });
    }
    this.scrollToBottom();
  }

  renderConversationsList() {
    const chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    const conversationsContainer = document.getElementById("conversationsList");
    const conversationIds = Object.keys(chatGemini);
    conversationsContainer.innerHTML = '';
    conversationIds.forEach((conversationId) => {
      const option = document.createElement("option");
      option.value = conversationId;
      option.textContent = `Conversation ID: ${conversationId}`;
      conversationsContainer.appendChild(option);
    });
    if (conversationIds.length > 0) {
      const lastOption = conversationsContainer.querySelector("option:last-child");
      lastOption.selected = true;
      this.selectConversation(lastOption.value);
    } else {
      this.createNewChat();
    }
  }

  selectConversation(conversationId) {
    this.currentConversationId = conversationId;
    this.renderMessages(conversationId);
    this.inputChat.focus();
  }

  deleteConversation(conversationId) {
    let chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    if (chatGemini[conversationId]) {
      delete chatGemini[conversationId];
      localStorage.setItem("chatGemini", JSON.stringify(chatGemini));
    }
    this.messageList.innerHTML = "";
    this.renderConversationsList();
  }

  scrollToBottom() {
    const lastMessage = this.chatContainer.lastElementChild;
    lastMessage.scrollIntoView({ behavior: "smooth", block: "end" });
    setTimeout(() => {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }, 500);
    this.inputChat.focus();
  }

  createNewChat() {
    const newConversationId = this.generateUniqueId();
    this.currentConversationId = newConversationId;
    this.inputChat.value = "";
    this.messageList.innerHTML = "";
    let chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    chatGemini[newConversationId] = [];
    localStorage.setItem("chatGemini", JSON.stringify(chatGemini));
    this.renderConversationsList();
    this.inputChat.focus();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // If you need to create a new API key, visit the following link to generate one:
  // https://aistudio.google.com/app/apikey?hl=pt-br
  new TerminalAesthetics("Your_GeminiAPIKEY");
});
