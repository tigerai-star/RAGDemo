import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';

const ChatContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  background: #eaeaea;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
`;

const MessageForm = styled.form`
  display: flex;

  input {
    flex: 1;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  button {
    background-color: #0078D7;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    margin-left: 10px;
  }
`;

const flyInAnimation = keyframes`
  from {
    opacity: 0;
    transform: translate(-20px, -20px);
  }
  to {
    opacity: 1;
    transform: translate(0, 0);
  }
`;

const Message = styled.div`
  margin: 10px 0;
  padding: 10px;
  border-radius: 4px;
  max-width: 70%;
  word-wrap: break-word;

  &.user {
    background-color: #0078D7;
    color: white;
    align-self: flex-end;
    margin-left: auto;
  }

  &.assistant {
    background-color: #f1f1f1;
    align-self: flex-start;
  }

  p {
    margin: 0 0 10px 0;
  }

  ul, ol {
    margin: 0 0 10px 0;
    padding-left: 20px;
  }

  code {
    background-color: #f0f0f0;
    padding: 2px 4px;
    border-radius: 3px;
  }

  pre {
    background-color: #f0f0f0;
    padding: 10px;
    border-radius: 3px;
    overflow-x: auto;
  }
`;

const AnimatedSpan = styled.span`
  display: inline-block;
  animation: ${flyInAnimation} 0.5s ease-out forwards;
`;

const CitationsSection = styled.div`
  margin-top: 10px;
  font-size: 0.9em;
`;

function ChatSection({ indexName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    setIsProcessing(true);

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: input }], index_name: indexName })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '', citations: [] }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0].delta.content) {
                setMessages(prev => {
                  if (window.lastMessage === parsed.choices[0].delta.content) return prev;
                  window.lastMessage = parsed.choices[0].delta.content;
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  lastMessage.content += parsed.choices[0].delta.content;
                  return newMessages;
                });
              }
              if (parsed.choices && parsed.choices[0].delta.context && parsed.choices[0].delta.context.citations) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  lastMessage.citations = parsed.choices[0].delta.context.citations;
                  return newMessages;
                });
              }
            } catch (error) {
              console.error('Error parsing JSON:', error, 'Raw data:', data);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: 'An error occurred while processing your request.', citations: [] }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const sanitizeHTML = (str) => {
    return str.replace(/[&<>"']/g, (match) => {
      const escape = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return escape[match];
    });
  };
  const formatMessage = (content) => {
    let formatted = sanitizeHTML(content);
    
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    formatted = formatted.replace(/^(#{1,6})\s(.+)/gm, (match, hashes, title) => {
      const level = hashes.length;
      return `<h${level}>${title}</h${level}>`;
    });
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  };

  const renderMessage = (message, index) => {
    const renderedContent = message.role === 'assistant'
      ? <div dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }} />
      : message.content;

    return (
      <Message key={index} className={message.role}>
        {message.role === 'assistant' ? (
          <AnimatedSpan>{renderedContent}</AnimatedSpan>
        ) : (
          renderedContent
        )}
        {message.citations && message.citations.length > 0 && (
          <CitationsSection>
            <h4>Citations</h4>
            <ul>
              {message.citations.map((citation, citationIndex) => (
                <li key={citationIndex}>
                  <a href="#">{citation.title}</a> [doc{citationIndex}]
                </li>
              ))}
            </ul>
          </CitationsSection>
        )}
      </Message>
    );
  };

  return (
    <ChatContainer>
      <MessagesContainer ref={messagesContainerRef}>
        {messages.map(renderMessage)}
      </MessagesContainer>
      <MessageForm onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isProcessing}
        />
        <button type="submit" disabled={isProcessing}>Send</button>
      </MessageForm>
    </ChatContainer>
  );
}

export default ChatSection;