import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function QuickAuthForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Auto-create test account on load
  useEffect(() => {
    quickSignIn();
  }, []);

  const quickSignIn = async () => {
    setLoading(true);
    setMessage('Setting up your account...');

    const testEmail = 'admin@9box.test';
    const testPassword = 'admin123456';

    try {
      // Try to sign in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      if (signInError) {
        // If sign in fails, create the account
        setMessage('Creating new account...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: testEmail,
          password: testPassword,
          options: {
            data: {
              full_name: 'Admin User',
            },
          }
        });

        if (!signUpError) {
          // Sign in immediately after signup
          const { data, error } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword,
          });
          
          if (!error && data.user) {
            // Create user profile
            await supabase.from('users').insert({
              id: data.user.id,
              email: data.user.email,
              full_name: 'Admin User',
              role: 'admin'
            });
            setMessage('Account created! Logging you in...');
          }
        } else {
          setMessage('Error: ' + signUpError.message);
        }
      } else if (signInData.user) {
        // Check if profile exists
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', signInData.user.id)
          .single();
          
        if (!profile) {
          // Create profile if it doesn't exist
          await supabase.from('users').insert({
            id: signInData.user.id,
            email: signInData.user.email,
            full_name: 'Admin User',
            role: 'admin'
          });
        }
        setMessage('Logged in successfully!');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setMessage('Error occurred. Please refresh and try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '2rem' }}>9-Box Talent Assessment</h1>
        
        <button
          onClick={quickSignIn}
          style={{
            padding: '1rem 2rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1.2rem',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          {loading ? 'Signing you in...' : 'Click to Enter App'}
        </button>

        {message && (
          <p style={{ marginTop: '1rem', color: '#666' }}>{message}</p>
        )}

        <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#999' }}>
          Auto-login enabled for development
        </p>
      </div>
    </div>
  );
}