import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Step1FigmaPick } from './steps/Step1FigmaPick'
import { Step2Compare } from './steps/Step2Compare'
import { Step3Scoring } from './steps/Step3Scoring'
import { Step4Dashboard } from './steps/Step4Dashboard'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Step1FigmaPick />} />
          <Route path="/compare" element={<Step2Compare />} />
          <Route path="/score" element={<Step3Scoring />} />
          <Route path="/dashboard" element={<Step4Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
