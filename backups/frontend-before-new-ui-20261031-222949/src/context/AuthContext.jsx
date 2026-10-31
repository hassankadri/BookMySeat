import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import axios from "axios";

const AuthContext =
  createContext();

const API_URL =
  process.env.REACT_APP_BACKEND_URL;

const TOKEN_KEY =
  "token";

// =====================================================
// ERROR FORMATTER
// =====================================================

const formatApiError = (
  data
) => {
  if (!data) {
    return "Something went wrong";
  }

  if (
    typeof data.error ===
    "string"
  ) {
    return data.error;
  }

  if (
    typeof data.message ===
    "string"
  ) {
    return data.message;
  }

  if (
    Array.isArray(
      data.errors
    )
  ) {
    return data.errors
      .map(
        (error) =>
          error.msg ||
          "Invalid input"
      )
      .join(
        ", "
      );
  }

  return "Something went wrong";
};

// =====================================================
// TOKEN HELPERS
// =====================================================

const decodeJwtPayload = (
  token
) => {
  try {
    const parts =
      String(
        token
      ).split(".");

    if (
      parts.length !==
      3
    ) {
      return null;
    }

    const base64 =
      parts[1]
        .replace(
          /-/g,
          "+"
        )
        .replace(
          /_/g,
          "/"
        );

    const padding =
      "=".repeat(
        (
          4 -
          (base64.length %
            4)
        ) %
          4
      );

    return JSON.parse(
      decodeURIComponent(
        window
          .atob(
            base64 +
              padding
          )
          .split("")
          .map(
            (character) =>
              `%${(
                "00" +
                character
                  .charCodeAt(
                    0
                  )
                  .toString(
                    16
                  )
              ).slice(
                -2
              )}`
          )
          .join("")
      )
    );
  } catch {
    return null;
  }
};

const isUsableToken = (
  token
) => {
  if (!token) {
    return false;
  }

  const payload =
    decodeJwtPayload(
      token
    );

  if (!payload) {
    return false;
  }

  if (
    payload.type !==
    "ACCESS"
  ) {
    return false;
  }

  if (
    !payload.exp
  ) {
    return false;
  }

  return (
    payload.exp *
      1000 >
    Date.now()
  );
};

const readStoredToken =
  () => {
    const token =
      localStorage.getItem(
        TOKEN_KEY
      );

    if (
      !isUsableToken(
        token
      )
    ) {
      localStorage.removeItem(
        TOKEN_KEY
      );

      return null;
    }

    return token;
  };

// =====================================================
// HOOK
// =====================================================

export const useAuth =
  () => {
    const context =
      useContext(
        AuthContext
      );

    if (!context) {
      throw new Error(
        "useAuth must be used within AuthProvider"
      );
    }

    return context;
  };

// =====================================================
// PROVIDER
// =====================================================

export const AuthProvider =
  ({
    children,
  }) => {
    const [
      user,
      setUser,
    ] =
      useState(null);

    const [
      loading,
      setLoading,
    ] =
      useState(true);

    const [
      token,
      setToken,
    ] =
      useState(
        readStoredToken
      );

    // =================================================
    // CLEAR SESSION
    // =================================================

    const clearSession =
      () => {
        localStorage.removeItem(
          TOKEN_KEY
        );

        setToken(
          null
        );

        setUser(
          null
        );
      };

    // =================================================
    // SAVE SESSION
    // =================================================

    const saveSession =
      (
        newToken,
        userData
      ) => {
        if (
          !isUsableToken(
            newToken
          )
        ) {
          throw new Error(
            "Server returned an invalid authentication token."
          );
        }

        localStorage.setItem(
          TOKEN_KEY,
          newToken
        );

        setToken(
          newToken
        );

        setUser(
          userData
        );
      };

    // =================================================
    // VERIFY EXISTING SESSION
    // =================================================

    useEffect(() => {
      let active =
        true;

      const checkAuth =
        async () => {
          if (!token) {
            if (active) {
              setUser(
                null
              );

              setLoading(
                false
              );
            }

            return;
          }

          if (
            !isUsableToken(
              token
            )
          ) {
            if (active) {
              clearSession();

              setLoading(
                false
              );
            }

            return;
          }

          if (active) {
            setLoading(
              true
            );
          }

          try {
            const response =
  await axios.get(
    `${API_URL}/api/auth/me`,

    {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    }
  );

            if (active) {
              setUser(
                response.data
                  .user
              );
            }
          } catch {
            if (active) {
              clearSession();
            }
          } finally {
            if (active) {
              setLoading(
                false
              );
            }
          }
        };

      checkAuth();

      return () => {
        active =
          false;
      };
    }, [token]);

    // =================================================
    // CROSS-TAB LOGOUT / LOGIN
    // =================================================

    useEffect(() => {
      const handleStorage =
        (
          event
        ) => {
          if (
            event.key !==
            TOKEN_KEY
          ) {
            return;
          }

          const newToken =
            event.newValue;

          if (
            isUsableToken(
              newToken
            )
          ) {
            setToken(
              newToken
            );
          } else {
            setToken(
              null
            );

            setUser(
              null
            );
          }
        };

      window.addEventListener(
        "storage",
        handleStorage
      );

      return () => {
        window.removeEventListener(
          "storage",
          handleStorage
        );
      };
    }, []);

    // =================================================
    // PASSWORD LOGIN
    // =================================================

    const login =
      async (
        email,
        password
      ) => {
        try {
          const response =
            await axios.post(
              `${API_URL}/api/auth/login`,

              {
                email:
                  email
                    .trim()
                    .toLowerCase(),

                password,
              }
            );

          saveSession(
            response.data
              .token,

            response.data
              .user
          );

          return {
            success:
              true,

            user:
              response.data
                .user,
          };
        } catch (error) {
          return {
            success:
              false,

            error:
              formatApiError(
                error.response
                  ?.data
              ),

            code:
              error.response
                ?.data
                ?.code,
          };
        }
      };

    // =================================================
    // GOOGLE LOGIN
    // =================================================

    const loginWithGoogle =
      async (
        credential
      ) => {
        try {
          const response =
            await axios.post(
              `${API_URL}/api/auth/google`,

              {
                credential,
              }
            );

          saveSession(
            response.data
              .token,

            response.data
              .user
          );

          return {
            success:
              true,

            user:
              response.data
                .user,
          };
        } catch (error) {
          return {
            success:
              false,

            error:
              formatApiError(
                error.response
                  ?.data
              ),
          };
        }
      };

    // =================================================
    // REGISTRATION
    // =================================================

    const requestRegistrationOtp =
      async (
        name,
        email,
        password
      ) => {
        try {
          const response =
            await axios.post(
              `${API_URL}/api/auth/register`,

              {
                name:
                  name.trim(),

                email:
                  email
                    .trim()
                    .toLowerCase(),

                password,
              }
            );

          return {
            success:
              true,

            ...response.data,
          };
        } catch (error) {
          return {
            success:
              false,

            error:
              formatApiError(
                error.response
                  ?.data
              ),

            retryAfterSeconds:
              error.response
                ?.data
                ?.retryAfterSeconds,
          };
        }
      };

    const register =
      requestRegistrationOtp;

    const verifyRegistrationOtp =
      async (
        email,
        otp
      ) => {
        try {
          const response =
            await axios.post(
              `${API_URL}/api/auth/verify-email`,

              {
                email:
                  email
                    .trim()
                    .toLowerCase(),

                otp,
              }
            );

          return {
            success:
              true,

            ...response.data,
          };
        } catch (error) {
          return {
            success:
              false,

            error:
              formatApiError(
                error.response
                  ?.data
              ),
          };
        }
      };

    const resendRegistrationOtp =
      async (
        email
      ) => {
        try {
          const response =
            await axios.post(
              `${API_URL}/api/auth/resend-verification`,

              {
                email:
                  email
                    .trim()
                    .toLowerCase(),
              }
            );

          return {
            success:
              true,

            ...response.data,
          };
        } catch (error) {
          return {
            success:
              false,

            error:
              formatApiError(
                error.response
                  ?.data
              ),

            retryAfterSeconds:
              error.response
                ?.data
                ?.retryAfterSeconds,
          };
        }
      };

    // =================================================
    // PASSWORD RESET
    // =================================================

    const requestPasswordReset =
      async (
        email
      ) => {
        try {
          const response =
            await axios.post(
              `${API_URL}/api/auth/forgot-password`,

              {
                email:
                  email
                    .trim()
                    .toLowerCase(),
              }
            );

          return {
            success:
              true,

            ...response.data,
          };
        } catch (error) {
          return {
            success:
              false,

            error:
              formatApiError(
                error.response
                  ?.data
              ),

            retryAfterSeconds:
              error.response
                ?.data
                ?.retryAfterSeconds,
          };
        }
      };

    const verifyPasswordResetOtp =
      async (
        email,
        otp
      ) => {
        try {
          const response =
            await axios.post(
              `${API_URL}/api/auth/verify-reset-otp`,

              {
                email:
                  email
                    .trim()
                    .toLowerCase(),

                otp,
              }
            );

          return {
            success:
              true,

            ...response.data,
          };
        } catch (error) {
          return {
            success:
              false,

            error:
              formatApiError(
                error.response
                  ?.data
              ),
          };
        }
      };

    const resetPassword =
      async (
        resetToken,
        password
      ) => {
        try {
          const response =
            await axios.post(
              `${API_URL}/api/auth/reset-password`,

              {
                resetToken,
                password,
              }
            );

          // Password changes invalidate any existing
          // access JWT because its password fingerprint
          // no longer matches.
          clearSession();

          return {
            success:
              true,

            ...response.data,
          };
        } catch (error) {
          return {
            success:
              false,

            error:
              formatApiError(
                error.response
                  ?.data
              ),
          };
        }
      };

    // =================================================
    // LOGOUT
    // =================================================

    const logout =
      () => {
        clearSession();
      };

    // =================================================
    // PROVIDER
    // =================================================

    return (
      <AuthContext.Provider
        value={{
          user,
          token,
          loading,

          login,
          loginWithGoogle,

          logout,
          register,

          requestRegistrationOtp,
          verifyRegistrationOtp,
          resendRegistrationOtp,

          requestPasswordReset,
          verifyPasswordResetOtp,
          resetPassword,

          isAuthenticated:
            Boolean(
              user
            ),
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };